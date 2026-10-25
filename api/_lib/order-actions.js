// "_lib" klasöründe olduğu için Vercel bunu ayrı bir route yapmıyor.
// api/order-action.js (panel içi butonlar) ve api/v2.js (action=cancel/refill,
// dış API) ikisi de aynı mantığı kullanır.

async function getProviderForOrder(db, order) {
  if (!order.provider_order_id) return null;
  const { data: service } = await db.from('services').select('provider_id').eq('id', order.service_id).maybeSingle();
  if (!service?.provider_id) return null;
  const { data: provider } = await db.from('api_providers').select('*').eq('id', service.provider_id).maybeSingle();
  return provider || null;
}

export async function cancelOrder(db, order) {
  if (['Completed', 'Canceled', 'Refunded'].includes(order.status)) {
    return { success: false, error: `Order is already ${order.status}, cannot cancel` };
  }

  const provider = await getProviderForOrder(db, order);
  let remains = order.remains != null ? Number(order.remains) : null;

  if (provider) {
    const orderParam = isNaN(Number(order.provider_order_id))
      ? order.provider_order_id
      : Number(order.provider_order_id);

    // İade tutarını olabildiğince doğru hesaplamak için iptalden hemen önce
    // sağlayıcıdan en güncel "remains" bilgisini çekmeyi dene. Başarısız
    // olursa elimizdeki son bilinen değerle devam ederiz.
    try {
      const statusResp = await fetch(provider.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: provider.api_key, action: 'status', order: orderParam }),
      });
      const statusText = await statusResp.text();
      const statusData = JSON.parse(statusText);
      if (statusData && statusData.remains != null && !statusData.error) {
        remains = Number(statusData.remains);
      }
    } catch {
      // Taze veri alınamadı, elimizdeki son bilinen remains ile devam ediyoruz.
    }

    // Sağlayıcıya iletilmiş bir siparişse önce orada iptal etmeyi dene.
    // jawenzysmm.com'un action=cancel'ı desteklediği doğrulanmadı - desteklemiyorsa
    // sağlayıcı bir error döner, biz de onu olduğu gibi yukarı taşırız.
    try {
      const resp = await fetch(provider.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: provider.api_key, action: 'cancel', order: orderParam }),
      });
      const text = await resp.text();
      let data = null;
      try { data = JSON.parse(text); } catch { /* sağlayıcı JSON dönmediyse görmezden gel, yereldeki iptali engelleme */ }
      if (data && data.error) {
        return { success: false, error: `Sağlayıcı iptal etmedi: ${data.error}` };
      }
    } catch (e) {
      return { success: false, error: `Sağlayıcıya ulaşılamadı: ${e.message}` };
    }
  }

  // Teslim edilmemiş kısım oranında iade (remains hiç bilinmiyorsa, yani
  // sipariş hiç senkronize edilmediyse, hiçbir şey teslim edilmemiş kabul
  // edilip tam iade yapılır).
  const quantity = Number(order.quantity) || 0;
  const charge = Number(order.charge) || 0;
  const refundAmount =
    remains != null && quantity > 0
      ? Math.max(0, Math.min(charge, Math.round(charge * (remains / quantity) * 100) / 100))
      : charge;

  const { data: result, error } = await db.rpc('apply_order_cancel', {
    p_order_id: order.id,
    p_refund_amount: refundAmount,
  });

  if (error) return { success: false, error: error.message };
  if (result && result.success === false) return { success: false, error: result.error };

  return { success: true, status: 'Canceled', refund_amount: refundAmount };
}

export async function refillOrder(db, order) {
  if (!['Completed', 'Partial'].includes(order.status)) {
    return { success: false, error: 'Refill can only be requested for Completed or Partial orders' };
  }

  const provider = await getProviderForOrder(db, order);
  if (!provider) {
    return { success: false, error: 'This service has no upstream provider, refill is not available' };
  }

  const orderParam = isNaN(Number(order.provider_order_id))
    ? order.provider_order_id
    : Number(order.provider_order_id);

  const response = await fetch(provider.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: provider.api_key, action: 'refill', order: orderParam }),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { success: false, error: `Sağlayıcı JSON dönmedi (HTTP ${response.status}): ${text.slice(0, 150)}` };
  }

  if (!response.ok || data.error) {
    return { success: false, error: data.error || `HTTP ${response.status}` };
  }

  const refillId = String(data.refill ?? data.id ?? '');
  await db
    .from('orders')
    .update({ refill_id: refillId, refill_requested_at: new Date().toISOString() })
    .eq('id', order.id);

  return { success: true, refill_id: refillId };
}

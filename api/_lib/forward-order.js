// Bu dosya "_lib" klasöründe olduğu için Vercel bunu ayrı bir route/endpoint
// olarak yayınlamaz - sadece diğer /api fonksiyonlarının import ettiği paylaşılan
// bir yardımcı modül. provider-order.js ve v2.js (action=add) ikisi de bunu kullanır.

export async function forwardOrderToProvider(db, orderId) {
  const { data: order } = await db.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return { success: false, error: 'Sipariş bulunamadı' };

  if (order.provider_order_id) {
    return { success: true, forwarded: true, already_forwarded: true, provider_order_id: order.provider_order_id };
  }

  const { data: service } = await db.from('services').select('*').eq('id', order.service_id).maybeSingle();
  if (!service || !service.provider_id || !service.original_id) {
    // Elle eklenmiş yerel bir servis - sağlayıcıya gönderilecek bir şey yok.
    return { success: true, forwarded: false, reason: 'local_service' };
  }

  const { data: provider } = await db.from('api_providers').select('*').eq('id', service.provider_id).maybeSingle();
  if (!provider || !provider.enabled) {
    return { success: true, forwarded: false, reason: 'provider_disabled' };
  }

  // service alanı sağlayıcının dokümantasyonundaki gibi mümkünse sayı olarak gider
  const serviceParam = isNaN(Number(service.original_id)) ? service.original_id : Number(service.original_id);

  const response = await fetch(provider.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: provider.api_key,
      action: 'add',
      service: serviceParam,
      link: order.link,
      quantity: order.quantity,
    }),
  });

  // Önce ham metni al - sağlayıcı JSON yerine HTML/hata sayfası dönerse
  // bunu görebilelim (yanlış URL, sağlayıcı tarafında hata vb.)
  const responseText = await response.text();
  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    await db.from('orders').update({ status: 'Error' }).eq('id', order.id);
    return { success: false, error: `Sağlayıcı JSON dönmedi (HTTP ${response.status}): ${responseText.slice(0, 200)}` };
  }

  if (!response.ok || data.error) {
    await db.from('orders').update({ status: 'Error' }).eq('id', order.id);
    return { success: false, error: data.error || `HTTP ${response.status}` };
  }

  const providerOrderId = String(data.order ?? data.order_id ?? data.id ?? '');

  await db
    .from('orders')
    .update({ provider_order_id: providerOrderId, status: 'Processing' })
    .eq('id', order.id);

  return { success: true, forwarded: true, provider_order_id: providerOrderId };
}
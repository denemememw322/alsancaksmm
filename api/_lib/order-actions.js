import { callProvider, providerError } from './provider-http.js';

async function loadProvider(db, order) {
  const { data } = await db.from('api_providers').select('*').eq('id', order.provider_id).maybeSingle();
  return data;
}

function firstTruthyError(data, orderId) {
  // Standart yanıtlar: {"error":"..."} | [{"order":1,"cancel":1}] | [{"order":1,"cancel":{"error":"..."}}] | {"refill":"5"} | {"refill":{"error":"..."}}
  const top = providerError(data);
  if (top) return top;
  const item = Array.isArray(data) ? data.find((x) => String(x?.order) === String(orderId)) ?? data[0] : data;
  for (const k of ['cancel', 'refill']) {
    if (item && item[k] && typeof item[k] === 'object' && item[k].error) return String(item[k].error);
  }
  return null;
}

// İPTAL: sağlayıcı kabul ederse talep "pending" kalır; sipariş İPTAL EDİLDİ olarak işaretlenmez.
// Gerçek iptal/iade, sağlayıcıdan gelen sipariş durumuyla (sync) tek güvenli fonksiyonda uygulanır.
export async function cancelOrder(db, orderUuid, { actorId = null, source = 'user' } = {}) {
  const { data: check } = await db.rpc('order_cancel_check', { p_order: orderUuid });
  if (!check?.allowed) return { success: false, error: check?.reason || 'İptal edilemez' };
  const { data: order } = await db.from('orders').select('*').eq('id', orderUuid).maybeSingle();
  const provider = await loadProvider(db, order);
  if (!provider) return { success: false, error: 'Sağlayıcı bulunamadı' };

  const { data: action, error: aErr } = await db.from('order_actions')
    .insert({ order_id: orderUuid, action: 'cancel', actor_id: actorId, source }).select('id').single();
  if (aErr) return { success: false, error: aErr.message };

  try {
    const { data } = await callProvider(provider, { action: 'cancel', orders: String(order.provider_order_id) });
    const err = firstTruthyError(data, order.provider_order_id);
    if (err) {
      await db.from('order_actions').update({ status: 'rejected', response: err.slice(0, 300), updated_at: new Date().toISOString() }).eq('id', action.id);
      return { success: false, error: `Sağlayıcı iptali kabul etmedi: ${err}` };
    }
    await db.from('order_actions').update({ response: JSON.stringify(data).slice(0, 300), updated_at: new Date().toISOString() }).eq('id', action.id);

    // Hemen gerçek durumu sorgula: sağlayıcı iptali anında uyguladıysa iade şimdi işlenir
    let applied = null;
    try {
      const { data: st } = await callProvider(provider, { action: 'status', order: String(order.provider_order_id) });
      if (st && !providerError(st) && st.status) {
        const norm = String(st.status).toLowerCase();
        const status = norm.includes('cancel') ? 'Canceled' : norm.includes('partial') ? 'Partial' : norm.includes('complet') ? 'Completed' : norm.includes('progress') ? 'Processing' : 'Pending';
        const remains = st.remains != null && st.remains !== '' ? Math.round(Number(st.remains)) : null;
        const { data: r } = await db.rpc('sync_order_from_provider', { p_order_id: orderUuid, p_status: status, p_remains: remains, p_start_count: null, p_event_key: null });
        applied = r;
      }
    } catch { /* zamanlayıcı bir sonraki turda işler */ }
    return { success: true, accepted: true, refund: applied?.refund ?? 0, message: 'İptal talebi sağlayıcı tarafından kabul edildi.' };
  } catch (e) {
    await db.from('order_actions').update({ status: 'failed', response: e.message.slice(0, 300), updated_at: new Date().toISOString() }).eq('id', action.id);
    return { success: false, error: e.message };
  }
}

// REFILL: yalnızca sipariş anındaki garanti anlık görüntüsüne göre ve sağlayıcı gerçekten kabul ederse
export async function refillOrder(db, orderUuid, { actorId = null, source = 'user' } = {}) {
  const { data: check } = await db.rpc('order_refill_check', { p_order: orderUuid });
  if (!check?.allowed) return { success: false, error: check?.reason || 'Refill yapılamaz' };
  const { data: order } = await db.from('orders').select('*').eq('id', orderUuid).maybeSingle();
  const provider = await loadProvider(db, order);
  if (!provider) return { success: false, error: 'Sağlayıcı bulunamadı' };

  const { data: action, error: aErr } = await db.from('order_actions')
    .insert({ order_id: orderUuid, action: 'refill', actor_id: actorId, source }).select('id').single();
  if (aErr) return { success: false, error: aErr.message };

  try {
    const { data } = await callProvider(provider, { action: 'refill', order: String(order.provider_order_id) });
    const err = firstTruthyError(data, order.provider_order_id);
    const item = Array.isArray(data) ? data[0] : data;
    const refillId = item?.refill ?? item?.refill_id ?? item?.id;
    if (err || refillId === undefined || refillId === null || typeof refillId === 'object') {
      const msg = err || 'Sağlayıcı refill numarası döndürmedi';
      await db.from('order_actions').update({ status: 'rejected', response: msg.slice(0, 300), updated_at: new Date().toISOString() }).eq('id', action.id);
      return { success: false, error: `Sağlayıcı refill'i kabul etmedi: ${msg}` };
    }
    await db.from('order_actions').update({ provider_ref: String(refillId), response: null, updated_at: new Date().toISOString() }).eq('id', action.id);
    await db.from('orders').update({ refill_id: String(refillId), refill_requested_at: new Date().toISOString() }).eq('id', orderUuid);
    return { success: true, refill_id: String(refillId) };
  } catch (e) {
    await db.from('order_actions').update({ status: 'failed', response: e.message.slice(0, 300), updated_at: new Date().toISOString() }).eq('id', action.id);
    return { success: false, error: e.message };
  }
}

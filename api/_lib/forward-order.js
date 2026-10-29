import { callProvider, providerError } from './provider-http.js';

// Siparişi sağlayıcıya iletir. Sağlayıcı ve sağlayıcı servis ID'si SİPARİŞ ANINDA kaydedilmiş anlık görüntüden gelir;
// hizmet eşlemesi sonradan değişse de eski sipariş yanlış sağlayıcıya gitmez.
// claim_order_forward: aynı siparişin iki kez (Vercel + zamanlayıcı) iletilmesini engeller.
export async function forwardOrderToProvider(db, orderUuid) {
  const { data: order, error } = await db.from('orders').select('*').eq('id', orderUuid).maybeSingle();
  if (error || !order) return { success: false, error: 'Sipariş bulunamadı' };
  if (!order.provider_id || !order.provider_service_id) return { success: true, forwarded: false };
  if (order.provider_order_id) return { success: true, forwarded: true, provider_order_id: order.provider_order_id, already: true };

  const { data: claimed } = await db.rpc('claim_order_forward', { p_order: orderUuid });
  if (claimed !== true) return { success: true, forwarded: false, claimed_elsewhere: true };

  const { data: provider } = await db.from('api_providers').select('*').eq('id', order.provider_id).maybeSingle();
  const fail = async (msg) => {
    await db.rpc('order_status_change', { p_order: orderUuid, p_new: 'Error', p_actor: null, p_source: 'system', p_note: `Sağlayıcıya iletilemedi: ${msg}`.slice(0, 250) });
    return { success: false, error: msg };
  };
  if (!provider || !provider.enabled) return fail('Sağlayıcı pasif veya silinmiş');

  const params = { action: 'add', service: order.provider_service_id, link: order.link };
  if (order.comments) {
    params.comments = order.comments;
    if (order.service_type === 'Custom Comments Package') params.quantity = String(order.quantity);
  } else {
    params.quantity = String(order.quantity);
  }

  try {
    const { data } = await callProvider(provider, params);
    const err = providerError(data);
    if (err) return fail(err);
    const providerOrderId = data?.order ?? data?.order_id ?? data?.id;
    if (!providerOrderId) return fail('Sağlayıcı sipariş numarası döndürmedi');
    await db.from('orders').update({ provider_order_id: String(providerOrderId) }).eq('id', orderUuid);
    await db.rpc('order_status_change', { p_order: orderUuid, p_new: 'Processing', p_actor: null, p_source: 'system', p_note: 'Sağlayıcıya iletildi' });
    return { success: true, forwarded: true, provider_order_id: String(providerOrderId) };
  } catch (e) {
    return fail(e.message);
  }
}

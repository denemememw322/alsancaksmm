import { supabase } from './supabase';

export type ProviderService = { id: string; name: string; category: string; rate: number; min: number; max: number; type: string; refill: boolean; cancel: boolean; dripfeed: boolean };

// Sağlayıcı işlemleri sunucuda yapılır (anahtar tarayıcıya inmez, admin izni sunucuda doğrulanır)
export async function providerApi(body: Record<string, unknown>) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  const r = await fetch('/api/provider-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok || !data?.ok) throw new Error(data?.error || `Sunucu hatası (HTTP ${r.status})`);
  return data;
}

export async function orderAction(orderId: string, type: 'cancel' | 'refill') {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  const r = await fetch('/api/order-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ order_id: orderId, type }),
  });
  const data = await r.json().catch(() => null);
  if (!data) throw new Error(`Sunucu hatası (HTTP ${r.status})`);
  if (data.error) throw new Error(data.error);
  return data;
}

export async function forwardOrders(ids: string[]) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  const r = await fetch('/api/provider-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ order_ids: ids.slice(0, 50) }),
  });
  return r.json().catch(() => null);
}

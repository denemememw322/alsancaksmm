import { createClient } from '@supabase/supabase-js';
import { cancelOrder, refillOrder } from './_lib/order-actions.js';

// Kullanıcı kendi siparişini, orders.manage izni olan yönetici ise her siparişi iptal/refill edebilir.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Sunucu yapılandırması eksik: SUPABASE_SERVICE_ROLE_KEY Vercel ortam değişkenlerinde tanımlı değil.' });
  }
  const db = createClient(supabaseUrl, serviceKey);
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    const { data: u, error: uErr } = await db.auth.getUser(token);
    if (uErr || !u?.user) return res.status(401).json({ error: 'Invalid session' });

    const { order_id: orderId, type } = req.body || {};
    if (!orderId || !['cancel', 'refill'].includes(type)) return res.status(400).json({ error: 'order_id ve type (cancel/refill) gerekli' });

    const { data: order } = await db.from('orders').select('id,user_id').eq('id', orderId).maybeSingle();
    if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı' });
    let source = 'user';
    if (order.user_id !== u.user.id) {
      const { data: ok } = await db.rpc('has_perm_for', { p_uid: u.user.id, p: 'orders.manage' });
      if (!ok) return res.status(403).json({ error: 'Bu sipariş sana ait değil' });
      source = 'admin';
    }
    const opts = { actorId: u.user.id, source };
    const result = type === 'cancel' ? await cancelOrder(db, orderId, opts) : await refillOrder(db, orderId, opts);
    if (!result.success) return res.status(200).json({ error: result.error });
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: `Beklenmeyen hata: ${e.message}` });
  }
}

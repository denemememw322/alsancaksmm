import { createClient } from '@supabase/supabase-js';
import { forwardOrderToProvider } from './_lib/forward-order.js';

// Yeni oluşturulan sipariş(ler)i sağlayıcıya iletir. Tek (order_id) veya toplu (order_ids, en çok 50).
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

    const body = req.body || {};
    const ids = Array.isArray(body.order_ids) ? body.order_ids : body.order_id ? [body.order_id] : [];
    if (ids.length === 0 || ids.length > 50) return res.status(400).json({ error: 'order_id veya 1-50 arası order_ids gerekli' });

    const { data: orders } = await db.from('orders').select('id,user_id').in('id', ids);
    const mine = new Set((orders || []).filter((o) => o.user_id === u.user.id).map((o) => o.id));
    const results = [];
    for (const id of ids) {
      if (!mine.has(id)) { results.push({ order_id: id, success: false, error: 'Sipariş bulunamadı veya sana ait değil' }); continue; }
      const r = await forwardOrderToProvider(db, id);
      results.push({ order_id: id, ...r });
    }
    if (!Array.isArray(body.order_ids)) return res.status(200).json(results[0]);
    return res.status(200).json({ success: true, results });
  } catch (e) {
    return res.status(500).json({ error: `Beklenmeyen hata: ${e.message}` });
  }
}

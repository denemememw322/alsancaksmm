import { createClient } from '@supabase/supabase-js';

// Sipariş durumları artık sunucu tarafı zamanlayıcıyla (her 2 dakikada) sağlayıcıdan senkronlanır ve
// iade/kısmi iade tek güvenli veritabanı fonksiyonunda işlenir. Bu uç nokta yalnızca güncel kayıtları döndürür.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Sunucu yapılandırması eksik.' });
  const db = createClient(supabaseUrl, serviceKey);
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const { data: u } = await db.auth.getUser(token);
    if (!u?.user) return res.status(401).json({ error: 'Invalid session' });
    const ids = Array.isArray(req.body?.order_ids) ? req.body.order_ids.slice(0, 200) : [];
    if (ids.length === 0) return res.status(200).json({ success: true, results: [] });
    const { data } = await db.from('orders').select('id,status,start_count,remains').eq('user_id', u.user.id).in('id', ids);
    return res.status(200).json({ success: true, results: data || [] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

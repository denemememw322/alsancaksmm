import { createClient } from '@supabase/supabase-js';
import { cancelOrder, refillOrder } from './_lib/order-actions.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({
      error: 'Sunucu yapılandırması eksik: SUPABASE_SERVICE_ROLE_KEY Vercel ortam değişkenlerinde tanımlı değil (veya son eklemeden sonra yeniden deploy edilmedi).',
    });
  }
  const db = createClient(supabaseUrl, serviceKey);

  try {
    // 1) Oturumu doğrula
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const { data: userData, error: userError } = await db.auth.getUser(token);
    if (userError || !userData?.user) return res.status(401).json({ error: 'Invalid session' });

    const { data: callerProfile } = await db
      .from('profiles')
      .select('role')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    const isAdmin = callerProfile?.role === 'admin';

    const { order_id, type } = req.body || {};
    if (!order_id || !['cancel', 'refill'].includes(type)) {
      return res.status(400).json({ error: 'order_id ve geçerli bir type (cancel/refill) gerekli' });
    }

    // 2) Sipariş gerçekten bu kullanıcıya mı ait (admin değilse)
    const { data: order } = await db.from('orders').select('*').eq('id', order_id).maybeSingle();
    if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı' });
    if (!isAdmin && order.user_id !== userData.user.id) {
      return res.status(403).json({ error: 'Bu sipariş sana ait değil' });
    }

    const result = type === 'cancel' ? await cancelOrder(db, order) : await refillOrder(db, order);
    return res.status(200).json(result);
  } catch (error) {
    console.error('order-action hatası:', error);
    return res.status(500).json({ error: error.message });
  }
}

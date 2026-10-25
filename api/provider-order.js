import { createClient } from '@supabase/supabase-js';
import { forwardOrderToProvider } from './_lib/forward-order.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('Eksik ortam değişkeni: SUPABASE_URL/VITE_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY yok.');
    return res.status(500).json({
      error: 'Sunucu yapılandırması eksik: SUPABASE_SERVICE_ROLE_KEY Vercel ortam değişkenlerinde tanımlı değil (veya son eklemeden sonra yeniden deploy edilmedi).',
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  try {
    // 1) İsteği yapan gerçekten giriş yapmış bir kullanıcı mı?
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const { order_id } = req.body || {};
    if (!order_id) return res.status(400).json({ error: 'order_id gerekli' });

    // 2) Sipariş gerçekten bu kullanıcıya mı ait?
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !order) return res.status(404).json({ error: 'Sipariş bulunamadı' });
    if (order.user_id !== userData.user.id) {
      return res.status(403).json({ error: 'Bu sipariş sana ait değil' });
    }

    // 3) Sağlayıcının GERÇEK API standardıyla ilet (services.provider_id/original_id
    // yoksa, yani elle eklenmiş yerel bir servisse, bu no-op döner)
    const result = await forwardOrderToProvider(supabaseAdmin, order.id);
    return res.status(200).json(result);
  } catch (error) {
    console.error('provider-order hatası:', error);
    return res.status(500).json({ error: error.message });
  }
}

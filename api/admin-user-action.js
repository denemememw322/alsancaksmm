import { createClient } from '@supabase/supabase-js';

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
    // 1) Çağıran gerçekten admin mi?
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const { data: userData, error: userError } = await db.auth.getUser(token);
    if (userError || !userData?.user) return res.status(401).json({ error: 'Invalid session' });

    const { data: callerProfile } = await db
      .from('profiles')
      .select('role')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (callerProfile?.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { target_user_id, action } = req.body || {};
    if (!target_user_id || !['ban', 'unban', 'delete'].includes(action)) {
      return res.status(400).json({ error: 'target_user_id ve geçerli bir action (ban/unban/delete) gerekli' });
    }

    // Kendi hesabında bu işlemleri yapamaz (yanlışlıkla kendini kilitlemesin diye)
    if (target_user_id === userData.user.id) {
      return res.status(400).json({ error: 'Kendi hesabında bu işlemi yapamazsın' });
    }

    if (action === 'ban') {
      // ~10 yıl - Supabase'de "kalıcı" ban böyle uygulanıyor, "none" ile kaldırılıyor.
      const { error } = await db.auth.admin.updateUserById(target_user_id, { ban_duration: '87600h' });
      if (error) return res.status(200).json({ error: error.message });
      await db.from('profiles').update({ banned: true }).eq('user_id', target_user_id);
      return res.status(200).json({ success: true });
    }

    if (action === 'unban') {
      const { error } = await db.auth.admin.updateUserById(target_user_id, { ban_duration: 'none' });
      if (error) return res.status(200).json({ error: error.message });
      await db.from('profiles').update({ banned: false }).eq('user_id', target_user_id);
      return res.status(200).json({ success: true });
    }

    if (action === 'delete') {
      const { count: ledgerCount } = await db.from('balance_ledger').select('id', { count: 'exact', head: true }).eq('user_id', target_user_id);
      if ((ledgerCount ?? 0) > 0) {
        return res.status(200).json({ error: 'Finansal geçmişi olan hesap silinemez. Bunun yerine banla (ban).' });
      }
      // auth.users satırını siler; profiles/orders/transactions/tickets hepsi
      // ON DELETE CASCADE ile bağlı olduğu için onlar da silinir (geri alınamaz).
      const { error } = await db.auth.admin.deleteUser(target_user_id);
      if (error) return res.status(200).json({ error: error.message });
      return res.status(200).json({ success: true });
    }
  } catch (error) {
    console.error('admin-user-action hatası:', error);
    return res.status(500).json({ error: error.message });
  }
}

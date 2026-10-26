import { createClient } from '@supabase/supabase-js';

// Sağlayıcının/smmtigers'ın kullandığı durum isimlerini panelin kendi
// sözlüğüne (Pending/Processing/Completed/Partial/Canceled/Refunded) indirger.
// "In progress" / "In Progress" gibi varyasyonları da yakalar.
function normalizeStatus(raw) {
  const s = String(raw || '').toLowerCase();
  if (s.includes('progress')) return 'Processing';
  if (s.includes('complet')) return 'Completed';
  if (s.includes('partial')) return 'Partial';
  if (s.includes('cancel')) return 'Canceled';
  if (s.includes('pending')) return 'Pending';
  if (s.includes('refund')) return 'Refunded';
  return raw ? String(raw) : 'Processing';
}

const FINAL_STATUSES = ['Completed', 'Canceled', 'Refunded'];

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

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  try {
    // 1) Kullanıcıyı doğrula
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    const isAdmin = callerProfile?.role === 'admin';

    const { order_ids } = req.body || {};
    if (!Array.isArray(order_ids) || order_ids.length === 0) {
      return res.status(400).json({ error: 'order_ids (dizi) gerekli' });
    }
    // Tek istekte üst sınır - sağlayıcıyı ve fonksiyon süresini korumak için.
    // Bekleyen sipariş sayın büyürse bunu artırmak yerine parti parti çağırmak
    // ya da zamanlanmış bir job'a geçmek gerekir.
    const idsToCheck = order_ids.slice(0, 50);

    const { data: orders } = await supabaseAdmin.from('orders').select('*').in('id', idsToCheck);

    const results = [];

    for (const order of orders || []) {
      if (!isAdmin && order.user_id !== userData.user.id) {
        results.push({ id: order.id, error: 'Yetkisiz' });
        continue;
      }
      if (!order.provider_order_id) {
        results.push({ id: order.id, skipped: true, reason: 'no_provider_order' });
        continue;
      }
      if (FINAL_STATUSES.includes(order.status)) {
        results.push({ id: order.id, skipped: true, status: order.status });
        continue;
      }

      const { data: service } = await supabaseAdmin
        .from('services')
        .select('provider_id')
        .eq('id', order.service_id)
        .maybeSingle();

      if (!service?.provider_id) {
        results.push({ id: order.id, error: 'Servis sağlayıcısı bulunamadı' });
        continue;
      }

      const { data: provider } = await supabaseAdmin
        .from('api_providers')
        .select('*')
        .eq('id', service.provider_id)
        .maybeSingle();

      if (!provider) {
        results.push({ id: order.id, error: 'Sağlayıcı bulunamadı' });
        continue;
      }

      try {
        const orderParam = isNaN(Number(order.provider_order_id))
          ? order.provider_order_id
          : Number(order.provider_order_id);

        const response = await fetch(provider.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: provider.api_key, action: 'status', order: orderParam }),
        });

        const text = await response.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          results.push({ id: order.id, error: `Sağlayıcı JSON dönmedi: ${text.slice(0, 150)}` });
          continue;
        }

        if (!response.ok || data.error) {
          results.push({ id: order.id, error: data.error || `HTTP ${response.status}` });
          continue;
        }

        const newStatus = normalizeStatus(data.status);
        const startCount = data.start_count != null ? Number(data.start_count) : order.start_count;
        const remains = data.remains != null ? Number(data.remains) : order.remains;

        // Durum + olası iade tek bir veritabanı fonksiyonunda, kilitli ve idempotent işlenir.
        const eventKey = `sync:${order.id}:${newStatus}:${remains ?? 'x'}`;
        const { data: syncResult, error: syncError } = await supabaseAdmin.rpc('sync_order_from_provider', {
          p_order_id: order.id,
          p_status: newStatus === 'Pending' || newStatus === 'Processing' || newStatus === 'Completed' || newStatus === 'Partial' || newStatus === 'Canceled' || newStatus === 'Refunded' ? newStatus : 'Processing',
          p_remains: remains != null ? Math.round(remains) : null,
          p_start_count: startCount != null ? Math.round(startCount) : null,
          p_event_key: eventKey,
        });
        if (syncError || syncResult?.success === false) {
          results.push({ id: order.id, error: syncError?.message || syncResult?.error });
          continue;
        }

        results.push({ id: order.id, status: newStatus, start_count: startCount, remains });
      } catch (e) {
        results.push({ id: order.id, error: e.message || 'Ağ hatası' });
      }
    }

    return res.status(200).json({ success: true, results });
  } catch (error) {
    console.error('sync-order-status hatası:', error);
    return res.status(500).json({ error: error.message });
  }
}

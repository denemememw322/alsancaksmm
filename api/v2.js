import { createClient } from '@supabase/supabase-js';
import { forwardOrderToProvider } from './_lib/forward-order.js';
import { cancelOrder, refillOrder } from './_lib/order-actions.js';

// Perfect Panel / jawenzysmm.com ile aynı sözleşme: tek endpoint, POST body'de
// key + action. Hata durumlarında bile HTTP 200 + {"error": "..."} dönüyoruz,
// çünkü bu ekosistemdeki entegrasyon araçlarının çoğu böyle bekliyor
// (jawenzysmm.com'un kendi API'si de böyle çalışıyor).

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(200).json({ error: 'Only POST requests are supported' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('Eksik ortam değişkeni: SUPABASE_URL/VITE_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY yok.');
    return res.status(500).json({ error: 'Server misconfigured' });
  }
  const db = createClient(supabaseUrl, serviceKey);

  try {
    const body = req.body || {};
    const { key, action } = body;

    if (!key) return res.status(200).json({ error: 'Missing key parameter' });
    if (!action) return res.status(200).json({ error: 'Missing action parameter' });

    // key her action için doğrulanıyor - jawenzysmm.com'un kendi örnekleri de
    // "services" dahil her istekte key gönderiyor.
    const { data: profile } = await db.from('profiles').select('*').eq('api_key', key).maybeSingle();
    if (!profile) {
      return res.status(200).json({ error: 'Invalid API key' });
    }

    if (action === 'services') {
      const { data: services, error: servicesError } = await db
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true });

      if (servicesError) {
        console.error('services sorgusu başarısız:', servicesError);
        return res.status(200).json({ error: 'Failed to load services: ' + servicesError.message });
      }

      if (!services || services.length === 0) {
        console.warn('services sorgusu boş döndü - services tablosunda is_active=true kayıt yok.');
      }

      const list = (services || []).map((s) => ({
        service: Number(s.service_id),
        name: s.name,
        type: s.type || 'Default',
        category: s.category,
        rate: Number(s.rate_per_1000),
        min: s.min_order,
        max: s.max_order,
      }));
      return res.status(200).json(list);
    }

    if (action === 'balance') {
      return res.status(200).json({ balance: Number(profile.balance).toFixed(4), currency: 'USD' });
    }

    if (action === 'add') {
      const { service, link, quantity } = body;
      if (!service || !link || !quantity) {
        return res.status(200).json({ error: 'service, link and quantity parameters are required' });
      }

      const { data: svc } = await db
        .from('services')
        .select('*')
        .eq('service_id', Number(service))
        .eq('is_active', true)
        .maybeSingle();

      if (!svc) return res.status(200).json({ error: 'Incorrect service ID' });

      const { data: result, error } = await db.rpc('place_order', {
        p_service_id: svc.id,
        p_link: link,
        p_quantity: Number(quantity),
        p_user_id: profile.user_id,
      });

      if (error) return res.status(200).json({ error: error.message });
      if (result && result.success === false) return res.status(200).json({ error: result.error });

      // Bu servis bir sağlayıcıdan senkronize edilmişse zinciri devam ettir
      // (senin panelin -> jawenzysmm.com -> smmtigers.com)
      if (svc.provider_id && svc.original_id) {
        await forwardOrderToProvider(db, result.order_uuid);
      }

      return res.status(200).json({ order: result.order_id });
    }

    if (action === 'status') {
      const { order, orders } = body;
      if (!order && !orders) {
        return res.status(200).json({ error: 'order or orders parameter is required' });
      }

      // Toplu mod: "orders": "1,2,3" -> {"1": {...}, "2": {...}, "3": {...}}
      // Bunun adı da "status" action'ı ama tekil "order" yerine çoğul "orders" alıyor.
      if (orders) {
        const ids = String(orders)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 100); // tek istekte üst sınır

        const numericIds = ids.map(Number).filter((n) => !isNaN(n));

        const { data: found } = await db
          .from('orders')
          .select('*')
          .in('order_id', numericIds)
          .eq('user_id', profile.user_id);

        const byId = new Map((found || []).map((o) => [String(o.order_id), o]));

        const result = {};
        for (const id of ids) {
          const ord = byId.get(id);
          result[id] = ord
            ? {
                charge: Number(ord.charge).toFixed(4),
                start_count: ord.start_count,
                status: ord.status,
                remains: ord.remains,
                currency: 'USD',
              }
            : { error: 'Incorrect order ID' };
        }
        return res.status(200).json(result);
      }

      // Tekli mod (mevcut davranış)
      const { data: ord } = await db
        .from('orders')
        .select('*')
        .eq('order_id', Number(order))
        .eq('user_id', profile.user_id)
        .maybeSingle();

      if (!ord) return res.status(200).json({ error: 'Incorrect order ID' });

      return res.status(200).json({
        charge: Number(ord.charge).toFixed(4),
        start_count: ord.start_count,
        status: ord.status,
        remains: ord.remains,
        currency: 'USD',
      });
    }

    if (action === 'cancel' || action === 'refill') {
      const { order } = body;
      if (!order) return res.status(200).json({ error: 'order parameter is required' });

      const { data: ord } = await db
        .from('orders')
        .select('*')
        .eq('order_id', Number(order))
        .eq('user_id', profile.user_id)
        .maybeSingle();

      if (!ord) return res.status(200).json({ error: 'Incorrect order ID' });

      const result = action === 'cancel' ? await cancelOrder(db, ord) : await refillOrder(db, ord);
      if (!result.success) return res.status(200).json({ error: result.error });

      return res.status(200).json(action === 'cancel' ? { cancel: '1' } : { refill: result.refill_id });
    }

    return res.status(200).json({ error: 'Incorrect action' });
  } catch (error) {
    console.error('api/v2 hatası:', error);
    return res.status(500).json({ error: error.message });
  }
}

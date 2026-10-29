import { createClient } from '@supabase/supabase-js';
import { HttpError, callProvider, providerError, isPrivateIp, assertSafeUrl } from './_lib/provider-http.js';

async function callChecked(provider, params) {
  const r = await callProvider(provider, params);
  const err = providerError(r.data);
  if (err) throw new HttpError(502, `Sağlayıcı hatası: ${r.scrub(err).slice(0, 200)}`);
  return r;
}

// Yönetici sağlayıcı işlemleri: bağlantı testi, hizmet listesi, hizmet ID doğrulama.
// - Yalnızca admin çağırabilir (Supabase oturum jetonu doğrulanır).
// - Sağlayıcı API anahtarı sunucuda veritabanından okunur, tarayıcıya hiç gönderilmez.
// - Yalnızca https ve genel (özel ağ olmayan) adresler çağrılır (SSRF koruması).

function extractList(data) {
  if (Array.isArray(data)) return data;
  for (const k of ['services', 'service', 'data', 'result', 'response']) {
    if (Array.isArray(data?.[k])) return data[k];
  }
  return [];
}

function normalize(s) {
  const rate = Number(s.rate ?? s.price ?? 0);
  return {
    id: String(s.service ?? s.id ?? s.service_id ?? ''),
    name: String(s.name ?? s.service_name ?? '').slice(0, 300),
    category: String(s.category ?? 'Genel').slice(0, 200),
    rate: Number.isFinite(rate) ? rate : 0,
    min: Number(s.min ?? s.min_order ?? 0) || 0,
    max: Number(s.max ?? s.max_order ?? 0) || 0,
    type: String(s.type ?? 'Default'),
    refill: !!s.refill,
    cancel: !!s.cancel,
    dripfeed: !!s.dripfeed,
  };
}

// yalnızca testler için
export const __test = { isPrivateIp, assertSafeUrl, normalize, extractList };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      throw new HttpError(500, 'Sunucu yapılandırması eksik: SUPABASE_SERVICE_ROLE_KEY Vercel ortam değişkenlerinde tanımlı değil (eklendikten sonra yeniden dağıtım gerekir).');
    }
    const db = createClient(supabaseUrl, serviceKey);

    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) throw new HttpError(401, 'Oturum bulunamadı.');
    const { data: userData, error: userErr } = await db.auth.getUser(token);
    if (userErr || !userData?.user) throw new HttpError(401, 'Geçersiz oturum.');
    const { data: allowed } = await db.rpc('has_perm_for', { p_uid: userData.user.id, p: 'providers.manage' });
    if (!allowed) throw new HttpError(403, 'Bu işlem için providers.manage izni gerekli.');

    const { action, provider_id: providerId, service_id: serviceId } = req.body || {};
    if (!providerId) throw new HttpError(400, 'provider_id gerekli.');
    const { data: provider, error: pErr } = await db.from('api_providers').select('*').eq('id', providerId).maybeSingle();
    if (pErr || !provider) throw new HttpError(404, 'Sağlayıcı bulunamadı.');
    if (!provider.api_key) throw new HttpError(400, 'Bu sağlayıcı için API anahtarı kayıtlı değil.');

    if (action === 'test') {
      const { data, ms } = await callChecked(provider, { action: 'balance' });
      return res.status(200).json({ ok: true, balance: data.balance ?? null, currency: data.currency ?? null, latency_ms: ms });
    }

    if (action === 'services' || action === 'validate') {
      const { data, ms } = await callChecked(provider, { action: 'services' });
      const list = extractList(data).map(normalize).filter((s) => s.id && s.name);
      if (list.length === 0) throw new HttpError(502, 'Sağlayıcı hizmet listesi boş döndürdü veya biçimi tanınmadı.');
      if (action === 'services') return res.status(200).json({ ok: true, count: list.length, latency_ms: ms, services: list });
      const wanted = String(serviceId ?? '').trim();
      if (!wanted) throw new HttpError(400, 'service_id gerekli.');
      const found = list.find((s) => s.id === wanted);
      if (!found) return res.status(200).json({ ok: true, found: false, message: `Bu sağlayıcıda ${wanted} numaralı hizmet yok.` });
      return res.status(200).json({ ok: true, found: true, service: found });
    }

    throw new HttpError(400, 'Bilinmeyen işlem.');
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return res.status(status).json({ ok: false, error: e instanceof HttpError ? e.message : `Beklenmeyen hata: ${e.message}` });
  }
}

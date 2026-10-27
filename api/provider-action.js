import { createClient } from '@supabase/supabase-js';
import dns from 'node:dns/promises';
import net from 'node:net';

// Yönetici sağlayıcı işlemleri: bağlantı testi, hizmet listesi, hizmet ID doğrulama.
// - Yalnızca admin çağırabilir (Supabase oturum jetonu doğrulanır).
// - Sağlayıcı API anahtarı sunucuda veritabanından okunur, tarayıcıya hiç gönderilmez.
// - Yalnızca https ve genel (özel ağ olmayan) adresler çağrılır (SSRF koruması).

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::') return true;
    if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
    return v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb');
  }
  return true;
}

async function assertSafeUrl(raw) {
  let url;
  try { url = new URL(String(raw).trim()); } catch { throw new HttpError(400, 'Geçersiz API URL.'); }
  if (url.protocol !== 'https:') throw new HttpError(400, 'API URL https:// ile başlamalı.');
  if (url.username || url.password) throw new HttpError(400, 'API URL kullanıcı adı/parola içeremez.');
  let addrs;
  try { addrs = await dns.lookup(url.hostname, { all: true }); }
  catch { throw new HttpError(502, `Alan adı çözümlenemedi: ${url.hostname}`); }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
    throw new HttpError(400, 'API URL özel/yerel bir ağ adresine çözümleniyor, reddedildi.');
  }
  return url;
}

async function callProvider(provider, params) {
  const url = await assertSafeUrl(provider.url);
  const body = new URLSearchParams({ key: provider.api_key, ...params });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  const started = Date.now();
  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
      redirect: 'manual',
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new HttpError(502, e.name === 'AbortError'
      ? 'Sağlayıcı 25 saniyede yanıt vermedi (zaman aşımı).'
      : `Sağlayıcıya bağlanılamadı: ${e.cause?.code || e.message}`);
  } finally {
    clearTimeout(timer);
  }
  if (resp.status >= 300 && resp.status < 400) {
    throw new HttpError(502, `Sağlayıcı yönlendirme döndürdü (HTTP ${resp.status}). API URL adresini kontrol et.`);
  }
  const text = await resp.text();
  const scrub = (s) => s.split(provider.api_key).join('***');
  let data;
  try { data = JSON.parse(text); }
  catch { throw new HttpError(502, `Sağlayıcı JSON döndürmedi (HTTP ${resp.status}). Yanıtın başı: ${scrub(text.slice(0, 160))}`); }
  if (data && !Array.isArray(data) && data.error) {
    const e = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
    throw new HttpError(502, `Sağlayıcı hatası: ${scrub(e).slice(0, 200)}`);
  }
  if (!resp.ok) throw new HttpError(502, `Sağlayıcı HTTP ${resp.status} döndürdü.`);
  return { data, ms: Date.now() - started };
}

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
    const { data: caller } = await db.from('profiles').select('role,banned').eq('user_id', userData.user.id).maybeSingle();
    if (!caller || caller.role !== 'admin' || caller.banned) throw new HttpError(403, 'Bu işlem için admin yetkisi gerekli.');

    const { action, provider_id: providerId, service_id: serviceId } = req.body || {};
    if (!providerId) throw new HttpError(400, 'provider_id gerekli.');
    const { data: provider, error: pErr } = await db.from('api_providers').select('*').eq('id', providerId).maybeSingle();
    if (pErr || !provider) throw new HttpError(404, 'Sağlayıcı bulunamadı.');
    if (!provider.api_key) throw new HttpError(400, 'Bu sağlayıcı için API anahtarı kayıtlı değil.');

    if (action === 'test') {
      const { data, ms } = await callProvider(provider, { action: 'balance' });
      return res.status(200).json({ ok: true, balance: data.balance ?? null, currency: data.currency ?? null, latency_ms: ms });
    }

    if (action === 'services' || action === 'validate') {
      const { data, ms } = await callProvider(provider, { action: 'services' });
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

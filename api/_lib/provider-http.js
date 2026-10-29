import dns from 'node:dns/promises';
import net from 'node:net';

// Sağlayıcıya yapılan tüm sunucu çağrıları buradan geçer (SSRF koruması + gerçek hata mesajları).
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function isPrivateIp(ip) {
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

export async function assertSafeUrl(raw) {
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

export async function callProvider(provider, params, { timeoutMs = 25000, fetchImpl = fetch, skipDns = false } = {}) {
  const url = skipDns ? new URL(provider.url) : await assertSafeUrl(provider.url);
  const body = new URLSearchParams({ key: provider.api_key, ...params });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  let resp;
  try {
    resp = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
      redirect: 'manual',
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new HttpError(502, e.name === 'AbortError'
      ? `Sağlayıcı ${Math.round(timeoutMs / 1000)} saniyede yanıt vermedi (zaman aşımı).`
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
  if (!resp.ok && !(data && typeof data === 'object')) throw new HttpError(502, `Sağlayıcı HTTP ${resp.status} döndürdü.`);
  return { data, ms: Date.now() - started, scrub };
}

// Sağlayıcı yanıtındaki hata metnini çıkarır (string veya {error:{...}} biçimlerinde)
export function providerError(data) {
  if (data && !Array.isArray(data) && data.error) {
    return typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
  }
  return null;
}

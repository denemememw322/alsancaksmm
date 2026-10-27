import test from 'node:test';
import assert from 'node:assert/strict';
import { __test } from '../api/provider-action.js';

const { isPrivateIp, assertSafeUrl, normalize, extractList } = __test;

test('özel/yerel IP adresleri engellenir', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
});

test('genel IP adresleri geçer', () => {
  for (const ip of ['8.8.8.8', '104.21.0.1', '172.32.0.1', '2606:4700::1111']) {
    assert.equal(isPrivateIp(ip), false, ip);
  }
});

test('http, kimlik bilgili ve geçersiz URL reddedilir', async () => {
  await assert.rejects(assertSafeUrl('http://example.com/api'), /https/);
  await assert.rejects(assertSafeUrl('https://user:pw@example.com/api'), /kullanıcı adı/);
  await assert.rejects(assertSafeUrl('not a url'), /Geçersiz/);
});

test('localhost ve iç ağ alan adları reddedilir', async () => {
  await assert.rejects(assertSafeUrl('https://localhost/api'), /özel|çözümlen/);
  await assert.rejects(assertSafeUrl('https://127.0.0.1/api'), /özel/);
  await assert.rejects(assertSafeUrl('https://169.254.169.254/latest/meta-data'), /özel/);
});

test('hizmet listesi normalize edilir', () => {
  const n = normalize({ service: 6117, name: 'A', category: 'Cat', rate: '0.2058', min: 50, max: 1000000, refill: false, cancel: true });
  assert.deepEqual(n, { id: '6117', name: 'A', category: 'Cat', rate: 0.2058, min: 50, max: 1000000, type: 'Default', refill: false, cancel: true, dripfeed: false });
  assert.equal(normalize({ name: 'x', rate: 'abc' }).rate, 0);
});

test('farklı yanıt biçimlerinden liste çıkarılır', () => {
  assert.equal(extractList([1, 2]).length, 2);
  assert.equal(extractList({ services: [1] }).length, 1);
  assert.equal(extractList({ foo: 1 }).length, 0);
});

import handler from '../api/provider-action.js';

function mockRes() {
  const r = { code: 0, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.end = () => r;
  return r;
}

test('POST dışındaki istekler reddedilir', async () => {
  const res = mockRes();
  await handler({ method: 'GET', headers: {} }, res);
  assert.equal(res.code, 405);
});

test('servis anahtarı tanımlı değilse net hata verir', async () => {
  const keep = { a: process.env.SUPABASE_URL, b: process.env.VITE_SUPABASE_URL, c: process.env.SUPABASE_SERVICE_ROLE_KEY };
  delete process.env.SUPABASE_URL; delete process.env.VITE_SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = mockRes();
  await handler({ method: 'POST', headers: {}, body: {} }, res);
  assert.equal(res.code, 500);
  assert.match(res.body.error, /SUPABASE_SERVICE_ROLE_KEY/);
  Object.entries({ SUPABASE_URL: keep.a, VITE_SUPABASE_URL: keep.b, SUPABASE_SERVICE_ROLE_KEY: keep.c }).forEach(([k, v]) => { if (v) process.env[k] = v; });
});

test('oturum jetonu yoksa 401 döner', async () => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'x';
  const res = mockRes();
  await handler({ method: 'POST', headers: {}, body: { action: 'test', provider_id: 'p' } }, res);
  assert.equal(res.code, 401);
});

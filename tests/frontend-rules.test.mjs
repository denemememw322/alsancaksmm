import test from 'node:test';
import assert from 'node:assert/strict';
import { cancelState, refillState } from '../src/lib/orderRules.ts';
import { parseBulk } from '../src/lib/bulk.ts';

const day = 86400000;
const base = { id: 'o1', status: 'Completed', provider_order_id: 'P1', refill_allowed: true, cancel_allowed: true, guarantee_days: 30, completed_at: new Date(Date.now() - 5 * day).toISOString() };

test('refill: destek yoksa buton yok', () => {
  assert.equal(refillState({ ...base, refill_allowed: false }, new Set()).allowed, false);
  assert.equal(refillState({ ...base, provider_order_id: null }, new Set()).allowed, false);
});
test('refill: garanti süresi içinde açık, dolunca kapalı, lifetime sınırsız', () => {
  assert.equal(refillState(base, new Set()).allowed, true);
  assert.equal(refillState({ ...base, completed_at: new Date(Date.now() - 31 * day).toISOString() }, new Set()).allowed, false);
  assert.equal(refillState({ ...base, guarantee_days: 0, completed_at: new Date(Date.now() - 900 * day).toISOString() }, new Set()).allowed, true);
  assert.equal(refillState({ ...base, guarantee_days: 365, completed_at: new Date(Date.now() - 364 * day).toISOString() }, new Set()).allowed, true);
});
test('refill: tamamlanmamış sipariş ve devam eden talep', () => {
  assert.equal(refillState({ ...base, status: 'Processing' }, new Set()).allowed, false);
  const r = refillState(base, new Set(['o1']));
  assert.equal(r.allowed, false); assert.equal(r.pending, true);
});
test('iptal: yalnızca destekleyen hizmette ve bekleyen/işlenen siparişte; tamamlanınca kalkar', () => {
  assert.equal(cancelState({ ...base, status: 'Processing' }, new Set()).allowed, true);
  assert.equal(cancelState({ ...base, status: 'Pending' }, new Set()).allowed, true);
  assert.equal(cancelState({ ...base, status: 'Completed' }, new Set()).allowed, false);
  assert.equal(cancelState({ ...base, status: 'Processing', cancel_allowed: false }, new Set()).allowed, false);
  const p = cancelState({ ...base, status: 'Processing' }, new Set(['o1']));
  assert.equal(p.allowed, false); assert.equal(p.pending, true);
});

test('toplu sipariş ayrıştırma: geçerli, hatalı ve custom comments satırları', () => {
  const rows = parseBulk('101997 | https://instagram.com/p/a | 1000\nabc | https://x.test | 5\n101997 | link-degil | 10\n101997 | https://x.test | 0\nfoo\n\n101995 | https://youtu.be/x | 0 | harika; süper ;güzel');
  assert.equal(rows.length, 6);
  assert.deepEqual(rows[0].row, { service: 101997, link: 'https://instagram.com/p/a', quantity: 1000 });
  assert.match(rows[1].error, /Hizmet ID/); assert.match(rows[2].error, /link/i); assert.match(rows[3].error, /Miktar/); assert.match(rows[4].error, /Biçim/);
  assert.equal(rows[5].row.comments, 'harika\nsüper\ngüzel');
  assert.equal(rows[5].line, 7, 'satır numarası boş satırlar dahil gerçek konumu göstermeli');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAction, parseParams, STATUS_MAP } from '../api/v2.js';

function fakeDb(tables, rpcs = {}) {
  const from = (name) => {
    let rows = [...(tables[name] || [])];
    const api = {
      select() { return api; },
      eq(k, v) { rows = rows.filter((r) => r[k] === v); return api; },
      in(k, vs) { rows = rows.filter((r) => vs.includes(r[k])); return api; },
      order(k) { rows = [...rows].sort((a, b) => (a[k] > b[k]) - (a[k] < b[k])); return api; },
      range(a, b) { return Promise.resolve({ data: rows.slice(a, b + 1), error: null }); },
      maybeSingle() { return Promise.resolve({ data: rows[0] ?? null, error: null }); },
      then(res, rej) { return Promise.resolve({ data: rows, error: null }).then(res, rej); },
    };
    return api;
  };
  return { from, rpc: async (fn, args) => ({ data: await rpcs[fn](args), error: null }) };
}

const alice = { user_id: 'u1', balance: 12.5, banned: false, api_key: 'KEY-A' };
const bob = { user_id: 'u2', balance: 1, banned: false, api_key: 'KEY-B' };
const banned = { user_id: 'u3', balance: 1, banned: true, api_key: 'KEY-X' };

test('anahtar/işlem yoksa ve anahtar geçersizse standart hata', async () => {
  const db = fakeDb({ profiles: [alice] });
  assert.deepEqual(await handleAction(db, {}), { error: 'Incorrect request' });
  assert.deepEqual(await handleAction(db, { key: 'K' }), { error: 'Incorrect request' });
  assert.deepEqual(await handleAction(db, { key: 'YANLIS', action: 'services' }), { error: 'Invalid API key' });
});

test('banlı hesap reddedilir, bakiye biçimi standart', async () => {
  const db = fakeDb({ profiles: [alice, banned] });
  assert.deepEqual(await handleAction(db, { key: 'KEY-X', action: 'balance' }), { error: 'Account suspended' });
  assert.deepEqual(await handleAction(db, { key: 'KEY-A', action: 'balance' }), { balance: '12.5000', currency: 'USD' });
});

test('services: yalnızca aktif hizmetler, standart tür, string rate, refill/cancel bayrakları', async () => {
  const db = fakeDb({ profiles: [alice], services: [
    { service_id: 101995, name: 'YT Custom', category: 'YouTube', rate_per_1000: 3.234, min_order: 10, max_order: 1000, service_type: 'Custom Comments', refill_enabled: false, cancel_enabled: true, is_active: true },
    { service_id: 101996, name: 'Gizli', category: 'YouTube', rate_per_1000: 1, min_order: 10, max_order: 1000, service_type: 'Default', is_active: false },
    { service_id: 101997, name: 'IG', category: 'Instagram', rate_per_1000: 0.5, min_order: 50, max_order: 5000, service_type: null, refill_enabled: true, cancel_enabled: false, is_active: true },
  ] });
  const list = await handleAction(db, { key: 'KEY-A', action: 'services' });
  assert.equal(list.length, 2);
  assert.ok(!list.some((s) => s.service === 101996), 'pasif hizmet görünmemeli');
  const ig = list.find((s) => s.service === 101997);
  assert.deepEqual(ig, { service: 101997, name: 'IG', type: 'Default', category: 'Instagram', rate: '0.5000', min: '50', max: '5000', dripfeed: false, refill: true, cancel: false });
  assert.equal(list.find((s) => s.service === 101995).type, 'Custom Comments');
  assert.ok(list.every((s) => s.type !== 'API'), 'tür asla "API" olmamalı');
});

test('services: 1000 satır sınırını aşan listeyi eksiksiz döndürür', async () => {
  const many = Array.from({ length: 2500 }, (_, i) => ({ service_id: 200000 + i, name: 'S' + i, category: 'C', rate_per_1000: 1, min_order: 1, max_order: 10, service_type: 'Default', is_active: true }));
  const list = await handleAction(fakeDb({ profiles: [alice], services: many }), { key: 'KEY-A', action: 'services' });
  assert.equal(list.length, 2500);
});

test('add: geçersiz hizmet/bağlantı, bakiye yetersiz, başarı ve tekrar (duplicate) davranışı', async () => {
  const forwarded = [];
  const deps = { forward: async (_db, id) => { forwarded.push(id); return { success: true }; } };
  let last;
  const rpcs = { place_order: (args) => { last = args; return args.p_client_ref === 'dup' ? { success: true, duplicate: true, order_id: 7, order_uuid: 'o7' }
      : args.p_link.includes('fakir') ? { success: false, error: 'Insufficient balance' }
      : { success: true, order_id: 8, order_uuid: 'o8', charge: 1 }; } };
  const db = fakeDb({ profiles: [alice], services: [{ id: 'sv1', service_id: 101997, is_active: true }] }, rpcs);
  assert.deepEqual(await handleAction(db, { key: 'KEY-A', action: 'add', service: 'abc', link: 'x', quantity: 100 }, deps), { error: 'Incorrect service ID' });
  assert.deepEqual(await handleAction(db, { key: 'KEY-A', action: 'add', service: 999, link: 'x', quantity: 100 }, deps), { error: 'Incorrect service ID' });
  assert.deepEqual(await handleAction(db, { key: 'KEY-A', action: 'add', service: 101997, quantity: 100 }, deps), { error: 'Incorrect link' });
  assert.deepEqual(await handleAction(db, { key: 'KEY-A', action: 'add', service: 101997, link: 'https://fakir', quantity: 100 }, deps), { error: 'Not enough funds on balance' });
  assert.deepEqual(await handleAction(db, { key: 'KEY-A', action: 'add', service: 101997, link: 'https://ok.test', quantity: 100, comments: 'a\nb' }, deps), { order: 8 });
  assert.equal(last.p_user_id, 'u1'); assert.equal(last.p_comments, 'a\nb'); assert.equal(last.p_service_id, 'sv1');
  assert.deepEqual(forwarded, ['o8']);
  assert.deepEqual(await handleAction(db, { key: 'KEY-A', action: 'add', service: 101997, link: 'https://ok.test', quantity: 100, client_ref: 'dup' }, deps), { order: 7 });
  assert.deepEqual(forwarded, ['o8'], 'duplicate sipariş ikinci kez iletilmemeli');
});

test('status: tekli, çoklu, durum eşlemesi ve başkasının siparişi görünmez', async () => {
  const orders = [
    { id: 'a', user_id: 'u1', order_id: 1, charge: 2, start_count: 5, remains: 10, status: 'Processing' },
    { id: 'b', user_id: 'u1', order_id: 2, charge: 1, start_count: null, remains: null, status: 'Completed' },
    { id: 'c', user_id: 'u2', order_id: 3, charge: 9, start_count: 0, remains: 0, status: 'Completed' },
  ];
  const db = fakeDb({ profiles: [alice, bob], orders });
  assert.deepEqual(await handleAction(db, { key: 'KEY-A', action: 'status', order: '1' }), { charge: '2.00000', start_count: '5', status: 'In progress', remains: '10', currency: 'USD' });
  assert.deepEqual(await handleAction(db, { key: 'KEY-A', action: 'status', order: '3' }), { error: 'Incorrect order ID' });
  const multi = await handleAction(db, { key: 'KEY-A', action: 'status', orders: '1,2,3' });
  assert.equal(multi['1'].status, 'In progress'); assert.equal(multi['2'].status, 'Completed'); assert.deepEqual(multi['3'], { error: 'Incorrect order ID' });
  assert.equal(STATUS_MAP.Processing, 'In progress');
});

test('cancel ve refill: standart yanıt biçimleri', async () => {
  const orders = [{ id: 'a', user_id: 'u1', order_id: 1 }, { id: 'b', user_id: 'u1', order_id: 2 }];
  const deps = {
    cancel: async (_d, id) => (id === 'a' ? { success: true } : { success: false, error: 'Bu hizmet iptal desteklemiyor' }),
    refill: async (_d, id) => (id === 'a' ? { success: true, refill_id: '55' } : { success: false, error: 'Garanti süresi doldu' }),
  };
  const db = fakeDb({ profiles: [alice], orders });
  assert.deepEqual(await handleAction(db, { key: 'KEY-A', action: 'cancel', orders: '1,2,9' }, deps), [
    { order: 1, cancel: 1 }, { order: 2, cancel: { error: 'Bu hizmet iptal desteklemiyor' } }, { order: 9, cancel: { error: 'Incorrect order ID' } }]);
  assert.deepEqual(await handleAction(db, { key: 'KEY-A', action: 'refill', order: '1' }, deps), { refill: '55' });
  assert.deepEqual(await handleAction(db, { key: 'KEY-A', action: 'refill', order: '2' }, deps), { error: 'Garanti süresi doldu' });
  assert.deepEqual(await handleAction(db, { key: 'KEY-A', action: 'refill', orders: '1,2' }, deps), [
    { order: 1, refill: '55' }, { order: 2, refill: { error: 'Garanti süresi doldu' } }]);
});

test('refill_status: yalnızca kendi refill talebi', async () => {
  const db = fakeDb({ profiles: [alice], orders: [{ id: 'a', user_id: 'u1' }, { id: 'z', user_id: 'u2' }],
    order_actions: [{ action: 'refill', provider_ref: '55', status: 'completed', order_id: 'a' }, { action: 'refill', provider_ref: '66', status: 'pending', order_id: 'z' }] });
  assert.deepEqual(await handleAction(db, { key: 'KEY-A', action: 'refill_status', refill: '55' }), { status: 'Completed' });
  assert.deepEqual(await handleAction(db, { key: 'KEY-A', action: 'refill_status', refill: '66' }), { error: 'Refill not found' });
});

test('parseParams: GET sorgusu, JSON metni ve form metni', () => {
  assert.deepEqual(parseParams({ query: { key: 'k', action: 'services' } }), { key: 'k', action: 'services' });
  assert.deepEqual(parseParams({ body: '{"key":"k","action":"balance"}' }), { key: 'k', action: 'balance' });
  assert.deepEqual(parseParams({ body: 'key=k&action=status&order=5' }), { key: 'k', action: 'status', order: '5' });
  assert.deepEqual(parseParams({ query: {}, body: { key: 'k' } }), { key: 'k' });
});

test('bilinmeyen işlem standart hata döner', async () => {
  assert.deepEqual(await handleAction(fakeDb({ profiles: [alice] }), { key: 'KEY-A', action: 'hack' }), { error: 'Incorrect request' });
});

import { createClient } from '@supabase/supabase-js';
import { forwardOrderToProvider } from './_lib/forward-order.js';
import { cancelOrder, refillOrder } from './_lib/order-actions.js';

// Reseller API (Perfect Panel / standart SMM API v2 sözleşmesi).
// Desteklenen: balance, services, add, status (tekli+çoklu), cancel, refill, refill_status.
// POST (form/JSON) ve GET (query) kabul edilir; hatalar HTTP 200 + {"error": "..."} döner (standart).

export const STATUS_MAP = {
  Pending: 'Pending', Processing: 'In progress', Completed: 'Completed', Partial: 'Partial',
  Canceled: 'Canceled', Refunded: 'Canceled', Error: 'Pending',
};
const REFILL_STATUS_MAP = { pending: 'In progress', completed: 'Completed', rejected: 'Rejected', failed: 'Rejected' };

const money = (n, d = 4) => Number(n ?? 0).toFixed(d);
const toInt = (v) => (v === undefined || v === null || String(v).trim() === '' || !/^\d+$/.test(String(v).trim()) ? null : parseInt(String(v).trim(), 10));
const idList = (v, max = 100) => String(v ?? '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, max);

const RPC_ERRORS = {
  'Insufficient balance': 'Not enough funds on balance',
  'Quantity out of range': 'Incorrect quantity',
  'Service not found': 'Incorrect service ID',
  'Invalid link': 'Incorrect link',
  'Comments are required for this service': 'Incorrect comments',
  'Comments too long': 'Incorrect comments',
  'Account suspended': 'Account suspended',
};

export function parseParams(req) {
  const out = { ...(req.query || {}) };
  let body = req.body;
  if (typeof body === 'string' && body.trim()) {
    try { body = JSON.parse(body); } catch { body = Object.fromEntries(new URLSearchParams(body)); }
  }
  if (body && typeof body === 'object') Object.assign(out, body);
  return out;
}

async function fetchAll(buildQuery, pageSize = 1000) {
  const all = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    all.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return all;
}

export async function handleAction(db, params, deps = {}) {
  const forward = deps.forward || forwardOrderToProvider;
  const cancel = deps.cancel || cancelOrder;
  const refill = deps.refill || refillOrder;
  const key = typeof params.key === 'string' ? params.key.trim() : '';
  const action = typeof params.action === 'string' ? params.action.trim().toLowerCase() : '';
  if (!key || !action) return { error: 'Incorrect request' };

  const { data: profile } = await db.from('profiles').select('user_id,balance,banned').eq('api_key', key).maybeSingle();
  if (!profile) return { error: 'Invalid API key' };
  if (profile.banned) return { error: 'Account suspended' };

  if (action === 'balance') return { balance: money(profile.balance), currency: 'USD' };

  if (action === 'services') {
    const rows = await fetchAll(() => db.from('services')
      .select('service_id,name,category,rate_per_1000,min_order,max_order,service_type,refill_enabled,cancel_enabled')
      .eq('is_active', true).order('category').order('service_id'));
    return rows.map((s) => ({
      service: s.service_id, name: s.name, type: s.service_type || 'Default', category: s.category,
      rate: money(s.rate_per_1000), min: String(s.min_order), max: String(s.max_order),
      dripfeed: false, refill: !!s.refill_enabled, cancel: !!s.cancel_enabled,
    }));
  }

  if (action === 'add') {
    const serviceNum = toInt(params.service);
    if (!serviceNum) return { error: 'Incorrect service ID' };
    const { data: svc } = await db.from('services').select('id').eq('service_id', serviceNum).eq('is_active', true).maybeSingle();
    if (!svc) return { error: 'Incorrect service ID' };
    const link = typeof params.link === 'string' ? params.link.trim() : '';
    if (!link) return { error: 'Incorrect link' };
    const comments = typeof params.comments === 'string' && params.comments.trim() ? params.comments : null;
    const { data: r, error } = await db.rpc('place_order', {
      p_service_id: svc.id, p_link: link, p_quantity: toInt(params.quantity) ?? 0, p_user_id: profile.user_id,
      p_client_ref: params.client_ref ? String(params.client_ref).slice(0, 100) : null, p_comments: comments,
    });
    if (error) return { error: 'Server error, try again' };
    if (!r?.success) return { error: RPC_ERRORS[r?.error] || 'Incorrect request' };
    if (!r.duplicate) await forward(db, r.order_uuid).catch(() => {});
    return { order: r.order_id };
  }

  const loadOrders = async (ids) => {
    const nums = ids.map(toInt).filter((n) => n !== null);
    if (nums.length === 0) return [];
    const { data } = await db.from('orders')
      .select('id,order_id,charge,start_count,remains,status').eq('user_id', profile.user_id).in('order_id', nums);
    return data || [];
  };

  if (action === 'status') {
    const ids = idList(params.orders ?? params.order);
    if (ids.length === 0) return { error: 'Incorrect request' };
    const rows = await loadOrders(ids);
    const fmt = (o) => ({ charge: money(o.charge, 5), start_count: String(o.start_count ?? 0), status: STATUS_MAP[o.status] || 'Pending', remains: String(o.remains ?? 0), currency: 'USD' });
    if (params.orders === undefined) return rows[0] ? fmt(rows[0]) : { error: 'Incorrect order ID' };
    const out = {};
    for (const id of ids) { const o = rows.find((r) => String(r.order_id) === id); out[id] = o ? fmt(o) : { error: 'Incorrect order ID' }; }
    return out;
  }

  if (action === 'cancel' || action === 'refill') {
    const ids = idList(params.orders ?? params.order);
    if (ids.length === 0) return { error: 'Incorrect request' };
    const rows = await loadOrders(ids);
    const results = [];
    for (const id of ids) {
      const o = rows.find((r) => String(r.order_id) === id);
      if (!o) { results.push({ order: Number(id), [action]: { error: 'Incorrect order ID' } }); continue; }
      const r = action === 'cancel' ? await cancel(db, o.id, { source: 'api' }) : await refill(db, o.id, { source: 'api' });
      if (!r.success) results.push({ order: o.order_id, [action]: { error: r.error } });
      else results.push({ order: o.order_id, [action]: action === 'cancel' ? 1 : r.refill_id });
    }
    if (params.orders === undefined) {
      const r = results[0];
      if (action === 'refill') return r.refill?.error ? { error: r.refill.error } : { refill: String(r.refill) };
      return r.cancel?.error ? { error: r.cancel.error } : r;
    }
    return results;
  }

  if (action === 'refill_status') {
    const ids = idList(params.refills ?? params.refill);
    if (ids.length === 0) return { error: 'Incorrect request' };
    const { data: acts } = await db.from('order_actions').select('provider_ref,status,order_id').eq('action', 'refill').in('provider_ref', ids);
    const orderIds = [...new Set((acts || []).map((a) => a.order_id))];
    const { data: mine } = orderIds.length ? await db.from('orders').select('id').eq('user_id', profile.user_id).in('id', orderIds) : { data: [] };
    const mineSet = new Set((mine || []).map((o) => o.id));
    const status = (id) => {
      const a = (acts || []).find((x) => x.provider_ref === id && mineSet.has(x.order_id));
      return a ? { status: REFILL_STATUS_MAP[a.status] || 'In progress' } : { error: 'Refill not found' };
    };
    if (params.refills === undefined) return status(ids[0]);
    return ids.map((id) => ({ refill: Number(id) || id, status: status(id).status ?? { error: 'Refill not found' } }));
  }

  return { error: 'Incorrect request' };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(200).json({ error: 'Incorrect request' });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('v2: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY eksik');
    return res.status(200).json({ error: 'Server error, try again' });
  }
  try {
    const db = createClient(supabaseUrl, serviceKey);
    const out = await handleAction(db, parseParams(req));
    return res.status(200).json(out);
  } catch (e) {
    console.error('v2 error:', e.message);
    return res.status(200).json({ error: 'Server error, try again' });
  }
}

import { useEffect, useState } from 'react';
import { RefreshCw, Ban, RotateCcw, Check, Pencil, X, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { orderAction } from '@/lib/providerApi';
import { cancelState, refillState } from '@/lib/orderRules';

const FINAL_STATUSES = ['Completed', 'Canceled', 'Refunded'];

const STATUS_STYLES: Record<string, string> = {
  Completed: 'bg-success-500/10 text-success-400',
  Processing: 'bg-brand-500/10 text-brand-400',
  Pending: 'bg-warning-500/10 text-warning-400',
  Partial: 'bg-accent-500/10 text-accent-400',
  Canceled: 'bg-error-500/10 text-error-400',
  Refunded: 'bg-error-500/10 text-error-400',
  Error: 'bg-error-500/10 text-error-400',
};

// Error, sağlayıcıya iletim başarısız olduğunda sistem tarafından otomatik
// atanıyor (STATUS_STYLES'ta rengi duruyor) - ama elle seçilecek bir şey
// olmadığı için aşağıdaki listede yok. Refunded ise hiçbir otomatik akışta
// üretilmiyordu (Cancel zaten gereken iadeyi kendi içinde yapıyor), o yüzden
// tamamen kaldırıldı.
const ALL_STATUSES = ['Pending', 'Processing', 'Completed', 'Partial', 'Canceled'];

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [editingStartId, setEditingStartId] = useState<string | null>(null);
  const [startValue, setStartValue] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const syncStatuses = async (list: any[]) => {
    const idsToSync = list
      .filter((o) => o.provider_order_id && !FINAL_STATUSES.includes(o.status))
      .map((o) => o.id);
    if (idsToSync.length === 0) return;

    setSyncing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch('/api/sync-order-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ order_ids: idsToSync }),
      });
      const json = await res.json();
      if (json.success) {
        setOrders((prev) =>
          prev.map((o) => {
            const match = json.results.find((r: any) => r.id === o.id && r.status);
            return match ? { ...o, status: match.status, start_count: match.start_count, remains: match.remains } : o;
          })
        );
      }
    } catch (e) {
      console.error('Durum senkronizasyon hatası:', e);
    }
    setSyncing(false);
  };

  const loadOrders = () => {
    supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .then(async ({ data }) => {
        const list = data || [];
        setOrders(list);
        setLoading(false);
        await syncStatuses(list);
      });
  };

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStatus = async (orderId: string, status: string) => {
    setEditingStatusId(null);
    const { data, error } = await supabase.rpc('admin_set_order_status', { p_order_id: orderId, p_status: status });
    if (error || (data && data.success === false)) {
      window.alert(error?.message || data?.error || 'Bir hata oluştu');
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
  };

  const saveStartCount = async (orderId: string) => {
    const val = parseInt(startValue);
    if (isNaN(val) || val < 0) {
      window.alert('Geçerli bir başlangıç sayısı gir (0 ya da üzeri).');
      return;
    }
    setEditingStartId(null);
    const { data, error } = await supabase.rpc('admin_set_order_start_count', { p_order_id: orderId, p_start_count: val });
    if (error || (data && data.success === false)) {
      window.alert(error?.message || data?.error || 'Bir hata oluştu');
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, start_count: val } : o)));
  };

  const statuses = ['All', 'Processing', 'Completed', 'Pending', 'Partial', 'Canceled'];

  // Orders.tsx (müşteri tarafı) ile birebir aynı mantık: salt rakam girilirse
  // sipariş numarasıyla birebir eşleştir, aksi halde servis adında/bağlantıda geçme araması.
  const trimmedSearch = search.trim();
  const isOrderNumberSearch = trimmedSearch !== '' && /^\d+$/.test(trimmedSearch);

  const filteredOrders = orders.filter((o) => {
    const matchStatus = statusFilter === 'All' || o.status === statusFilter;
    const matchSearch = isOrderNumberSearch
      ? String(o.order_id) === trimmedSearch
      : (String(o.service_name || '').toLowerCase().includes(search.toLowerCase()) || String(o.link || '').toLowerCase().includes(search.toLowerCase()));
    return matchStatus && matchSearch;
  });

  const [pendingCancel, setPendingCancel] = useState<Set<string>>(new Set());
  const [pendingRefill, setPendingRefill] = useState<Set<string>>(new Set());
  const loadPending = async () => {
    const ids = orders.map((o: any) => o.id);
    if (ids.length === 0) return;
    const { data } = await supabase.from('order_actions').select('order_id,action').eq('status', 'pending').in('order_id', ids.slice(0, 500));
    setPendingCancel(new Set((data || []).filter((a: any) => a.action === 'cancel').map((a: any) => a.order_id)));
    setPendingRefill(new Set((data || []).filter((a: any) => a.action === 'refill').map((a: any) => a.order_id)));
  };

  useEffect(() => { loadPending(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders.length]);

  const runAction = async (order: any, type: 'cancel' | 'refill') => {
    if (type === 'cancel' && !window.confirm(`Order #${order.order_id} için iptal talebi sağlayıcıya gönderilsin mi? Sağlayıcı kabul ederse teslim edilmeyen kısım bakiyene iade edilir.`)) {
      return;
    }
    setActingId(order.id);
    try {
      const json = await orderAction(order.id, type);
      window.alert(type === 'cancel'
        ? (json.refund > 0 ? `İptal edildi, $${Number(json.refund).toFixed(4)} iade edildi.` : 'İptal talebi sağlayıcı tarafından kabul edildi. Sonuç ve iade birkaç dakika içinde otomatik işlenir.')
        : `Refill talebi sağlayıcı tarafından kabul edildi (Refill ID: ${json.refill_id}).`);
      
      await loadPending();
      loadOrders();
    } catch (e: any) {
      window.alert(e.message || 'Bir hata oluştu');
    }
    setActingId(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-text-primary">Orders</h2>
        <button
          onClick={() => syncStatuses(orders)}
          disabled={syncing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-bg-surface text-text-secondary border border-border-subtle hover:border-border-default transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Yenileniyor...' : 'Durumları Yenile'}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sipariş no, servis adı ya da bağlantı ara..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-bg-surface border border-border-default text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === s ? 'bg-brand-600 text-white' : 'bg-bg-surface text-text-secondary border border-border-subtle'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-2xl bg-bg-surface border border-border-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border-subtle">
              <tr className="text-text-muted text-xs uppercase">
                <th className="px-4 py-3 text-left">Order ID</th>
                <th className="px-4 py-3 text-left">Service</th>
                <th className="px-4 py-3 text-left">Quantity</th>
                <th className="px-4 py-3 text-left">Start</th>
                <th className="px-4 py-3 text-left">Remains</th>
                <th className="px-4 py-3 text-left">Charge</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Provider ID</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-text-muted">Loading...</td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-text-muted">No orders found</td></tr>
              ) : (
                filteredOrders.map((order) => {
                  const cancelS = cancelState(order, pendingCancel);
                  const refillS = refillState(order, pendingRefill);
                  const isActing = actingId === order.id;
                  return (
                    <tr key={order.id} className="border-b border-border-subtle">
                      <td className="px-4 py-3 text-text-muted">#{order.order_id}</td>
                      <td className="px-4 py-3 text-text-primary">{order.service_name}</td>
                      <td className="px-4 py-3 text-text-secondary">{order.quantity}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {order.provider_order_id ? (
                          // API'den gelen sipariş: salt okunur, otomatik senkronize ediliyor
                          order.start_count != null ? order.start_count : '—'
                        ) : editingStartId === order.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              autoFocus
                              value={startValue}
                              onChange={(e) => setStartValue(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && saveStartCount(order.id)}
                              className="w-20 px-2 py-1 rounded-lg bg-bg-elevated border border-border-default text-text-primary text-xs"
                            />
                            <button onClick={() => saveStartCount(order.id)} className="p-1 rounded bg-brand-600 hover:bg-brand-500 text-white">
                              <Check className="w-3 h-3" />
                            </button>
                            <button onClick={() => setEditingStartId(null)} className="p-1 text-text-muted hover:text-text-primary">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingStartId(order.id); setStartValue(order.start_count != null ? String(order.start_count) : ''); }}
                            title="Başlangıç sayısını elle gir (manuel sipariş)"
                            className="flex items-center gap-1 hover:text-brand-400 group"
                          >
                            {order.start_count != null ? order.start_count : '—'}
                            <Pencil className="w-3 h-3 text-text-muted group-hover:text-brand-400" />
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {order.remains != null ? order.remains : '—'}
                      </td>
                      <td className="px-4 py-3 text-text-primary">${order.charge?.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        {editingStatusId === order.id ? (
                          <select
                            autoFocus
                            defaultValue={order.status}
                            onChange={(e) => setStatus(order.id, e.target.value)}
                            onBlur={() => setEditingStatusId(null)}
                            className="px-2 py-1 rounded-lg bg-bg-elevated border border-border-default text-text-primary text-xs"
                          >
                            {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : (
                          <button
                            onClick={() => setEditingStatusId(order.id)}
                            title="Durumu elle değiştir"
                            className={`px-2 py-1 rounded-full text-xs hover:ring-1 hover:ring-brand-500/40 transition-all ${STATUS_STYLES[order.status] || 'bg-warning-500/10 text-warning-400'}`}
                          >
                            {order.status}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-muted">
                        {order.provider_order_id || '—'}
                      </td>
                      <td className="px-4 py-3 text-text-muted">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {cancelS.allowed && (
                            <button
                              title="Siparişi iptal et"
                              disabled={isActing}
                              onClick={() => runAction(order, 'cancel')}
                              className="p-1.5 rounded-lg text-text-muted hover:text-error-400 hover:bg-error-500/10 transition-colors disabled:opacity-50"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                          {cancelS.pending && <span title="İptal talebi sağlayıcıda" className="text-[11px] px-1.5 py-0.5 rounded bg-warning-500/10 text-warning-400">İptal bekliyor</span>}
                          {refillS.allowed && (
                            <button
                              title={refillS.lifetime ? 'Refill talep et (lifetime garanti)' : 'Refill talep et'}
                              disabled={isActing}
                              onClick={() => runAction(order, 'refill')}
                              className="p-1.5 rounded-lg text-text-muted hover:text-brand-400 hover:bg-brand-500/10 transition-colors disabled:opacity-50"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          {refillS.pending && <span title="Refill talebi sağlayıcıda" className="text-[11px] px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400">Refill bekliyor</span>}
                          {!cancelS.allowed && !cancelS.pending && !refillS.allowed && !refillS.pending && <span className="text-text-muted">—</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { ListOrdered, Search, RefreshCw, Ban, RotateCcw, Check } from 'lucide-react';
import { supabase, type Order } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { StatusBadge } from './Dashboard';

const FINAL_STATUSES = ['Completed', 'Canceled', 'Refunded'];

export default function Orders() {
  const { profile, refreshProfile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const syncStatuses = async (list: Order[]) => {
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
    if (!profile) return;
    supabase
      .from('orders')
      .select('*')
      .eq('user_id', profile.user_id)
      .order('created_at', { ascending: false })
      .then(async ({ data }) => {
        const list = (data as Order[]) ?? [];
        setOrders(list);
        setLoading(false);
        await syncStatuses(list);
      });
  };

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const runAction = async (order: Order, type: 'cancel' | 'refill') => {
    if (type === 'cancel' && !window.confirm(`Order #${order.order_id} iptal edilsin mi? Teslim edilmeyen kısım bakiyene iade edilecek.`)) {
      return;
    }
    setActingId(order.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch('/api/order-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ order_id: order.id, type }),
      });
      const json = await res.json();
      if (json.error) {
        window.alert(json.error);
      } else if (type === 'cancel') {
        setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: 'Canceled' } : o)));
        await refreshProfile();
      } else {
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, refill_id: json.refill_id, refill_requested_at: new Date().toISOString() } : o))
        );
      }
    } catch (e: any) {
      window.alert(e.message || 'Bir hata oluştu');
    }
    setActingId(null);
  };

  const statuses = ['All', 'Processing', 'Completed', 'Pending', 'Partial', 'Canceled'];

  // Arama kutusuna sadece rakam yazıldıysa (örn. "1", "5") bunu sipariş
  // numarası araması say ve BİREBİR eşleştir - "1" yazınca linkin içinde
  // rastgele bir "1" geçen tüm siparişlerin çıkması istenmiyordu. Rakam
  // dışında herhangi bir şey varsa (link, servis adı parçası vb.) eski
  // davranış (bağlantı/servis adında geçme) aynen çalışmaya devam ediyor.
  const trimmedSearch = search.trim();
  const isOrderNumberSearch = trimmedSearch !== '' && /^\d+$/.test(trimmedSearch);

  const filtered = orders.filter((o) => {
    const matchStatus = statusFilter === 'All' || o.status === statusFilter;
    const matchSearch = isOrderNumberSearch
      ? String(o.order_id) === trimmedSearch
      : (o.service_name.toLowerCase().includes(search.toLowerCase()) || o.link.toLowerCase().includes(search.toLowerCase()));
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">My Orders</h1>
          <p className="text-text-secondary text-sm mt-1">Track and manage all your orders</p>
        </div>
        <button
          onClick={() => syncStatuses(orders)}
          disabled={syncing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-bg-surface text-text-secondary border border-border-subtle hover:border-border-default transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Refreshing...' : 'Refresh status'}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by service, link, or order ID..."
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
            <thead>
              <tr className="border-b border-border-subtle text-text-muted text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">ID</th>
                <th className="text-left px-4 py-3 font-medium">Service</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Link</th>
                <th className="text-left px-4 py-3 font-medium">Qty</th>
                <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Start</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Remains</th>
                <th className="text-left px-4 py-3 font-medium">Charge</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Date</th>
                <th className="text-left px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-border-subtle">
                    {[...Array(10)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-5 rounded bg-bg-elevated animate-pulse" /></td>)}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-text-muted">
                    <ListOrdered className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No orders found
                  </td>
                </tr>
              ) : (
                filtered.map((o) => {
                  const canCancel = !FINAL_STATUSES.includes(o.status);
                  const canRefill = ['Completed', 'Partial'].includes(o.status) && !!o.provider_order_id;
                  const isActing = actingId === o.id;
                  return (
                    <tr key={o.id} className="border-b border-border-subtle hover:bg-bg-elevated transition-colors">
                      <td className="px-4 py-3 text-text-muted">#{o.order_id}</td>
                      <td className="px-4 py-3 font-medium text-text-primary max-w-[200px] truncate">{o.service_name}</td>
                      <td className="px-4 py-3 hidden md:table-cell max-w-[180px] truncate">
                        <a href={o.link} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">{o.link}</a>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{o.quantity.toLocaleString()}</td>
                      <td className="px-4 py-3 text-text-secondary hidden xl:table-cell">
                        {o.start_count != null ? o.start_count.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-text-secondary hidden lg:table-cell">
                        {o.remains != null ? o.remains.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-text-primary">${o.charge.toFixed(2)}</td>
                      <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                      <td className="px-4 py-3 text-text-muted hidden sm:table-cell whitespace-nowrap">
                        {new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {canCancel && (
                            <button
                              title="Cancel order"
                              disabled={isActing}
                              onClick={() => runAction(o, 'cancel')}
                              className="p-1.5 rounded-lg text-text-muted hover:text-error-400 hover:bg-error-500/10 transition-colors disabled:opacity-50"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                          {canRefill && (
                            o.refill_requested_at ? (
                              <span title="Refill requested" className="p-1.5 text-success-400">
                                <Check className="w-4 h-4" />
                              </span>
                            ) : (
                              <button
                                title="Request refill"
                                disabled={isActing}
                                onClick={() => runAction(o, 'refill')}
                                className="p-1.5 rounded-lg text-text-muted hover:text-brand-400 hover:bg-brand-500/10 transition-colors disabled:opacity-50"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )
                          )}
                          {!canCancel && !canRefill && <span className="text-text-muted">—</span>}
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

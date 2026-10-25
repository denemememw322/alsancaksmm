import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet, ListOrdered, TrendingUp, Clock, ArrowUpRight, ArrowDownRight,
  Package, ShoppingCart,
} from 'lucide-react';
import { supabase, type Order, type Transaction } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export default function Dashboard() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [o, t] = await Promise.all([
        supabase.from('orders').select('*').eq('user_id', profile.user_id).order('created_at', { ascending: false }).limit(5),
        supabase.from('transactions').select('*').eq('user_id', profile.user_id).order('created_at', { ascending: false }).limit(5),
      ]);
      setOrders((o.data as Order[]) ?? []);
      setTransactions((t.data as Transaction[]) ?? []);
      setLoading(false);
    })();
  }, [profile]);

  const stats = [
    { label: 'Account Balance', value: `$${(profile?.balance ?? 0).toFixed(2)}`, icon: Wallet, color: 'text-brand-400', bg: 'bg-brand-500/10' },
    { label: 'Total Orders', value: orders.length, icon: ListOrdered, color: 'text-accent-400', bg: 'bg-accent-500/10' },
    { label: 'Total Spent', value: `$${(profile?.total_spent ?? 0).toFixed(2)}`, icon: TrendingUp, color: 'text-success-400', bg: 'bg-success-500/10' },
    { label: 'Level', value: profile?.level ?? 'Standard', icon: Package, color: 'text-warning-400', bg: 'bg-warning-500/10' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-text-secondary text-sm mt-1">Overview of your account activity</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="p-5 rounded-2xl bg-bg-surface border border-border-subtle">
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div className="font-display text-2xl font-bold text-text-primary">{s.value}</div>
            <div className="text-sm text-text-muted mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Link to="/dashboard/new-order" className="group p-5 rounded-2xl bg-gradient-to-br from-brand-600/20 to-brand-600/5 border border-brand-500/20 hover:border-brand-500/40 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <ShoppingCart className="w-6 h-6 text-brand-400 mb-3" />
              <h3 className="font-semibold text-text-primary">Place a New Order</h3>
              <p className="text-sm text-text-secondary mt-1">Choose from 2,500+ services</p>
            </div>
            <ArrowUpRight className="w-5 h-5 text-text-muted group-hover:text-brand-400 transition-colors" />
          </div>
        </Link>
        <Link to="/dashboard/add-funds" className="group p-5 rounded-2xl bg-gradient-to-br from-accent-600/20 to-accent-600/5 border border-accent-500/20 hover:border-accent-500/40 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <Wallet className="w-6 h-6 text-accent-400 mb-3" />
              <h3 className="font-semibold text-text-primary">Add Funds</h3>
              <p className="text-sm text-text-secondary mt-1">Top up your balance instantly</p>
            </div>
            <ArrowUpRight className="w-5 h-5 text-text-muted group-hover:text-accent-400 transition-colors" />
          </div>
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent orders */}
        <div className="p-5 rounded-2xl bg-bg-surface border border-border-subtle">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-text-primary">Recent Orders</h2>
            <Link to="/dashboard/orders" className="text-sm text-brand-400 hover:text-brand-300">View all</Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-bg-elevated animate-pulse" />)}
            </div>
          ) : orders.length === 0 ? (
            <EmptyState icon={ListOrdered} text="No orders yet" />
          ) : (
            <div className="space-y-2">
              {orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between p-3 rounded-lg bg-bg-elevated">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">{o.service_name}</div>
                    <div className="text-xs text-text-muted">#{o.order_id} · {o.quantity.toLocaleString()} qty</div>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <div className="p-5 rounded-2xl bg-bg-surface border border-border-subtle">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-text-primary">Recent Transactions</h2>
            <Link to="/dashboard/transactions" className="text-sm text-brand-400 hover:text-brand-300">View all</Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-bg-elevated animate-pulse" />)}
            </div>
          ) : transactions.length === 0 ? (
            <EmptyState icon={Clock} text="No transactions yet" />
          ) : (
            <div className="space-y-2">
              {transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-bg-elevated">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      t.type === 'Deposit' ? 'bg-success-500/10' : 'bg-error-500/10'
                    }`}>
                      {t.type === 'Deposit' ? (
                        <ArrowDownRight className="w-4 h-4 text-success-400" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-error-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-text-primary truncate">{t.type}</div>
                      <div className="text-xs text-text-muted truncate">{t.description}</div>
                    </div>
                  </div>
                  <div className={`text-sm font-semibold ${t.type === 'Deposit' ? 'text-success-400' : 'text-error-400'}`}>
                    {t.type === 'Deposit' ? '+' : '-'}${Math.abs(t.amount).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof Clock; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-text-muted">
      <Icon className="w-8 h-8 mb-2 opacity-50" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Pending: 'bg-warning-500/10 text-warning-400 border-warning-500/20',
    Processing: 'bg-brand-500/10 text-brand-400 border-brand-500/20',
    Completed: 'bg-success-500/10 text-success-400 border-success-500/20',
    Partial: 'bg-accent-500/10 text-accent-400 border-accent-500/20',
    Canceled: 'bg-error-500/10 text-error-400 border-error-500/20',
    Refunded: 'bg-error-500/10 text-error-400 border-error-500/20',
    Error: 'bg-error-500/10 text-error-400 border-error-500/20',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${colors[status] ?? colors.Pending}`}>
      {status}
    </span>
  );
}

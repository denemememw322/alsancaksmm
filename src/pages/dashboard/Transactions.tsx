import { useEffect, useState } from 'react';
import { Receipt, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { supabase, type Transaction } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export default function Transactions() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', profile.user_id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTransactions((data as Transaction[]) ?? []);
        setLoading(false);
      });
  }, [profile]);

  const types = ['All', 'Deposit', 'Order', 'Refund', 'Affiliate'];
  const filtered = filter === 'All' ? transactions : transactions.filter((t) => t.type === filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Transactions</h1>
        <p className="text-text-secondary text-sm mt-1">Your full transaction history</p>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === t ? 'bg-brand-600 text-white' : 'bg-bg-surface text-text-secondary border border-border-subtle'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-bg-surface border border-border-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-text-muted text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Description</th>
                <th className="text-left px-4 py-3 font-medium">Amount</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-border-subtle">
                    {[...Array(5)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-5 rounded bg-bg-elevated animate-pulse" /></td>)}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-text-muted">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No transactions found
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="border-b border-border-subtle hover:bg-bg-elevated transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          t.type === 'Deposit' || t.type === 'Refund' || t.type === 'Affiliate' ? 'bg-success-500/10' : 'bg-error-500/10'
                        }`}>
                          {t.type === 'Deposit' || t.type === 'Refund' || t.type === 'Affiliate' ? (
                            <ArrowDownRight className="w-4 h-4 text-success-400" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4 text-error-400" />
                          )}
                        </div>
                        <span className="font-medium text-text-primary">{t.type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary max-w-[250px] truncate">{t.description}</td>
                    <td className={`px-4 py-3 font-semibold ${t.type === 'Deposit' || t.type === 'Refund' || t.type === 'Affiliate' ? 'text-success-400' : 'text-error-400'}`}>
                      {t.type === 'Deposit' || t.type === 'Refund' || t.type === 'Affiliate' ? '+' : '-'}${Math.abs(t.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-success-500/10 text-success-400 border border-success-500/20">
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                      {new Date(t.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

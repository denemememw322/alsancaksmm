import { useEffect, useState } from 'react';
import { Check, X, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const STATUS_STYLES: Record<string, string> = {
  Pending: 'bg-warning-500/10 text-warning-400',
  Completed: 'bg-success-500/10 text-success-400',
  Rejected: 'bg-error-500/10 text-error-400',
};

export default function AdminDeposits() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [users, setUsers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: txs } = await supabase
      .from('transactions')
      .select('*')
      .eq('type', 'Deposit')
      .order('created_at', { ascending: false });

    const list = txs || [];
    setTransactions(list);

    const userIds = Array.from(new Set(list.map((t) => t.user_id)));
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, email, username').in('user_id', userIds);
      const map: Record<string, any> = {};
      (profiles || []).forEach((p) => { map[p.user_id] = p; });
      setUsers(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const review = async (id: string, approve: boolean) => {
    setActingId(id);
    const { data, error } = await supabase.rpc('review_deposit', { p_transaction_id: id, p_approve: approve });
    setActingId(null);
    if (error || (data && data.success === false)) {
      window.alert(error?.message || data?.error || 'Bir hata oluştu');
      return;
    }
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, status: approve ? 'Completed' : 'Rejected' } : t)));
  };

  const pending = transactions.filter((t) => t.status === 'Pending');
  const reviewed = transactions.filter((t) => t.status !== 'Pending');

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-text-primary">Deposits</h2>
        <span className="flex items-center gap-1.5 text-xs text-warning-400">
          <Clock className="w-3.5 h-3.5" />
          {pending.length} bekliyor
        </span>
      </div>

      <div className="rounded-2xl bg-bg-surface border border-border-subtle overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border-subtle">
              <tr className="text-text-muted text-xs uppercase">
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Amount</th>
                <th className="px-4 py-3 text-left">Method</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">Loading...</td></tr>
              ) : pending.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">Bekleyen talep yok</td></tr>
              ) : (
                pending.map((t) => (
                  <tr key={t.id} className="border-b border-border-subtle">
                    <td className="px-4 py-3 text-text-primary">{users[t.user_id]?.email || users[t.user_id]?.username || t.user_id}</td>
                    <td className="px-4 py-3 font-semibold text-text-primary">${Number(t.amount).toFixed(2)}</td>
                    <td className="px-4 py-3 text-text-secondary">{t.description}</td>
                    <td className="px-4 py-3 text-text-muted">{new Date(t.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          disabled={actingId === t.id}
                          onClick={() => review(t.id, true)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-success-500/10 text-success-400 hover:bg-success-500/20 transition-colors disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          disabled={actingId === t.id}
                          onClick={() => review(t.id, false)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-error-500/10 text-error-400 hover:bg-error-500/20 transition-colors disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {reviewed.length > 0 && (
        <div className="rounded-2xl bg-bg-surface border border-border-subtle overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle text-sm font-medium text-text-secondary">Geçmiş</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {reviewed.slice(0, 30).map((t) => (
                  <tr key={t.id} className="border-b border-border-subtle last:border-0">
                    <td className="px-4 py-3 text-text-primary">{users[t.user_id]?.email || users[t.user_id]?.username || t.user_id}</td>
                    <td className="px-4 py-3 font-semibold text-text-primary">${Number(t.amount).toFixed(2)}</td>
                    <td className="px-4 py-3 text-text-secondary">{t.description}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${STATUS_STYLES[t.status]}`}>{t.status}</span>
                    </td>
                    <td className="px-4 py-3 text-text-muted">{new Date(t.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

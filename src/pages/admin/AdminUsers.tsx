import { useEffect, useState } from 'react';
import { Ban, CheckCircle2, Trash2, Wallet, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export default function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const [balanceEditFor, setBalanceEditFor] = useState<string | null>(null);
  const [balanceMode, setBalanceMode] = useState<'add' | 'set'>('add');
  const [balanceValue, setBalanceValue] = useState('');

  const load = () => {
    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setUsers(data || []);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const callUserAction = async (target_user_id: string, action: 'ban' | 'unban' | 'delete') => {
    if (action === 'delete') {
      if (!window.confirm('Bu kullanıcıyı SİLMEK istediğine emin misin? Hesabı, bakiyesi, tüm siparişleri ve işlem geçmişi KALICI olarak silinir, geri alınamaz.')) return;
    }
    if (action === 'ban' && !window.confirm('Bu kullanıcı banlansın mı? Giriş yapamaz hale gelir.')) return;

    setActingId(target_user_id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch('/api/admin-user-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ target_user_id, action }),
      });
      const json = await res.json();
      if (json.error) {
        window.alert(json.error);
      } else if (action === 'delete') {
        setUsers((prev) => prev.filter((u) => u.user_id !== target_user_id));
      } else {
        setUsers((prev) => prev.map((u) => (u.user_id === target_user_id ? { ...u, banned: action === 'ban' } : u)));
      }
    } catch (e: any) {
      window.alert(e.message || 'Bir hata oluştu');
    }
    setActingId(null);
  };

  const openBalanceEdit = (u: any) => {
    setBalanceEditFor(u.user_id);
    setBalanceMode('add');
    setBalanceValue('');
  };

  const applyBalance = async (target_user_id: string) => {
    const amt = parseFloat(balanceValue);
    if (isNaN(amt) || (balanceMode === 'add' && amt === 0)) return;
    const reason = window.prompt('Bakiye düzeltme nedeni (zorunlu, kayda geçer)');
    if (!reason || reason.trim().length < 3) return;
    setActingId(target_user_id);
    const { data, error } = await supabase.rpc('admin_adjust_balance', {
      p_target_user_id: target_user_id,
      p_mode: balanceMode,
      p_amount: amt,
      p_reason: reason,
    });
    setActingId(null);
    if (error || (data && data.success === false)) {
      window.alert(error?.message || data?.error || 'Bir hata oluştu');
      return;
    }
    setUsers((prev) => prev.map((u) => (u.user_id === target_user_id ? { ...u, balance: data.new_balance } : u)));
    setBalanceEditFor(null);
  };

  return (
    <div>
      <h2 className="font-semibold text-text-primary mb-4">Users</h2>
      <div className="rounded-2xl bg-bg-surface border border-border-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border-subtle">
              <tr className="text-text-muted text-xs uppercase">
                <th className="px-4 py-3 text-left">Username</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Balance</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Joined</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">No users found</td></tr>
              ) : (
                users.map((u) => {
                  const isSelf = u.user_id === user?.id;
                  const isActing = actingId === u.user_id;
                  const editingBalance = balanceEditFor === u.user_id;
                  return (
                    <>
                      <tr key={u.user_id} className="border-b border-border-subtle">
                        <td className="px-4 py-3 text-text-primary">{u.username || '—'}</td>
                        <td className="px-4 py-3 text-text-secondary">{u.email}</td>
                        <td className="px-4 py-3 text-text-primary">${Number(u.balance ?? 0).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            u.role === 'admin' ? 'bg-brand-500/10 text-brand-400' : 'bg-bg-hover text-text-secondary'
                          }`}>
                            {u.role || 'user'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {u.banned ? (
                            <span className="px-2 py-1 rounded-full text-xs bg-error-500/10 text-error-400">Banned</span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs bg-success-500/10 text-success-400">Active</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-text-muted">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              title="Bakiyeyi düzenle"
                              onClick={() => (editingBalance ? setBalanceEditFor(null) : openBalanceEdit(u))}
                              className="p-1.5 rounded-lg text-text-muted hover:text-brand-400 hover:bg-brand-500/10 transition-colors"
                            >
                              <Wallet className="w-4 h-4" />
                            </button>
                            {!isSelf && (
                              <button
                                title={u.banned ? 'Banı kaldır' : 'Banla'}
                                disabled={isActing}
                                onClick={() => callUserAction(u.user_id, u.banned ? 'unban' : 'ban')}
                                className="p-1.5 rounded-lg text-text-muted hover:text-warning-400 hover:bg-warning-500/10 transition-colors disabled:opacity-50"
                              >
                                {u.banned ? <CheckCircle2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                              </button>
                            )}
                            {!isSelf && (
                              <button
                                title="Sil"
                                disabled={isActing}
                                onClick={() => callUserAction(u.user_id, 'delete')}
                                className="p-1.5 rounded-lg text-text-muted hover:text-error-400 hover:bg-error-500/10 transition-colors disabled:opacity-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {editingBalance && (
                        <tr className="border-b border-border-subtle bg-bg-elevated/40">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="flex rounded-lg border border-border-default overflow-hidden">
                                <button
                                  onClick={() => setBalanceMode('add')}
                                  className={`px-3 py-1.5 text-xs font-medium ${balanceMode === 'add' ? 'bg-brand-600 text-white' : 'text-text-secondary'}`}
                                >
                                  Ekle (+)
                                </button>
                                <button
                                  onClick={() => setBalanceMode('set')}
                                  className={`px-3 py-1.5 text-xs font-medium ${balanceMode === 'set' ? 'bg-brand-600 text-white' : 'text-text-secondary'}`}
                                >
                                  Şuna ayarla (=)
                                </button>
                              </div>
                              <input
                                type="number"
                                step="0.01"
                                autoFocus
                                value={balanceValue}
                                onChange={(e) => setBalanceValue(e.target.value)}
                                placeholder={balanceMode === 'add' ? 'örn. 100' : 'örn. 50'}
                                className="w-32 px-3 py-1.5 rounded-lg bg-bg-base border border-border-default text-text-primary text-sm"
                              />
                              <button
                                onClick={() => applyBalance(u.user_id)}
                                disabled={isActing || !balanceValue}
                                className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium disabled:opacity-50"
                              >
                                Uygula
                              </button>
                              <button
                                onClick={() => setBalanceEditFor(null)}
                                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <span className="text-xs text-text-muted">
                                {balanceMode === 'add'
                                  ? `Mevcut bakiyeye eklenir (negatif girersen düşer).`
                                  : `Bakiye tam olarak bu değere ayarlanır.`}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
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

import { useEffect, useState } from 'react';
import { Check, X, Clock, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-warning-500/10 text-warning-400',
  awaiting_review: 'bg-brand-500/10 text-brand-400',
  approved: 'bg-success-500/10 text-success-400',
  rejected: 'bg-error-500/10 text-error-400',
  cancelled: 'bg-bg-hover text-text-muted',
};
const STATUS_TR: Record<string, string> = {
  pending: 'Ödeme bekleniyor',
  awaiting_review: 'Kontrol bekliyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  cancelled: 'İptal',
};

export default function AdminDeposits() {
  const [rows, setRows] = useState<any[]>([]);
  const [users, setUsers] = useState<Record<string, any>>({});
  const [methods, setMethods] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [filter, setFilter] = useState('open');
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    const [{ data: reqs }, { data: ms }] = await Promise.all([
      supabase.from('deposit_requests').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('payment_methods').select('id,name,network'),
    ]);
    const list = reqs || [];
    setRows(list);
    const mm: Record<string, any> = {};
    (ms || []).forEach((m) => { mm[m.id] = m; });
    setMethods(mm);
    const ids = Array.from(new Set(list.map((t: any) => t.user_id)));
    if (ids.length) {
      const { data: profiles } = await supabase.from('profiles').select('user_id,email,username').in('user_id', ids);
      const map: Record<string, any> = {};
      (profiles || []).forEach((p) => { map[p.user_id] = p; });
      setUsers(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const review = async (id: string, approve: boolean) => {
    const note = approve ? null : window.prompt('Red nedeni (opsiyonel)') ;
    if (approve && !window.confirm('Bu ödemeyi onaylayıp bakiyeyi yüklemek istiyor musun?')) return;
    setActingId(id);
    const { data, error } = await supabase.rpc('admin_review_deposit', { p_id: id, p_approve: approve, p_note: note });
    setActingId(null);
    if (error || (data && data.success === false)) {
      window.alert(error?.message || data?.error || 'Bir hata oluştu');
      return;
    }
    load();
  };

  const term = q.trim().toLowerCase();
  const shown = rows.filter((r) => {
    if (filter === 'open' && !['pending', 'awaiting_review'].includes(r.status)) return false;
    if (filter === 'awaiting_review' && r.status !== 'awaiting_review') return false;
    if (term) {
      const u = users[r.user_id];
      return [r.public_id, u?.email, u?.username].some((v) => String(v ?? '').toLowerCase().includes(term));
    }
    return true;
  });
  const awaiting = rows.filter((r) => r.status === 'awaiting_review').length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-semibold text-text-primary">Bakiye Talepleri</h2>
        <span className="flex items-center gap-1.5 text-xs text-brand-400"><Clock className="w-3.5 h-3.5" />{awaiting} kontrol bekliyor</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {[['open', 'Açık'], ['awaiting_review', 'Kontrol bekleyen'], ['all', 'Tümü']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-lg text-sm ${filter === k ? 'bg-brand-600 text-white' : 'bg-bg-elevated text-text-secondary'}`}>{l}</button>
        ))}
        <div className="relative ml-auto">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ödeme ID / e-posta ara"
            className="pl-9 pr-3 py-1.5 rounded-lg bg-bg-elevated border border-border-default text-sm text-text-primary" />
        </div>
      </div>

      <div className="rounded-2xl bg-bg-surface border border-border-subtle overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border-subtle">
            <tr className="text-text-muted text-xs uppercase">
              <th className="px-4 py-3 text-left">Ödeme ID</th>
              <th className="px-4 py-3 text-left">Kullanıcı</th>
              <th className="px-4 py-3 text-left">Tutar</th>
              <th className="px-4 py-3 text-left">Yöntem</th>
              <th className="px-4 py-3 text-left">Durum</th>
              <th className="px-4 py-3 text-left">Tarih</th>
              <th className="px-4 py-3 text-left">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">Yükleniyor...</td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">Kayıt yok</td></tr>
            ) : shown.map((t) => (
              <tr key={t.id} className="border-b border-border-subtle last:border-0">
                <td className="px-4 py-3 font-mono font-semibold text-text-primary">{t.public_id}</td>
                <td className="px-4 py-3 text-text-primary">{users[t.user_id]?.email || users[t.user_id]?.username || t.user_id}</td>
                <td className="px-4 py-3 font-semibold text-text-primary">${Number(t.amount).toFixed(2)}</td>
                <td className="px-4 py-3 text-text-secondary">{t.provider ? t.provider.toUpperCase() : methods[t.method_id]?.name ?? '-'}{methods[t.method_id]?.network ? ` (${methods[t.method_id].network})` : ''}</td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs ${STATUS_STYLES[t.status]}`}>{STATUS_TR[t.status] ?? t.status}</span></td>
                <td className="px-4 py-3 text-text-muted">{new Date(t.created_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  {['pending', 'awaiting_review'].includes(t.status) && (
                    <div className="flex items-center gap-1.5">
                      <button disabled={actingId === t.id} onClick={() => review(t.id, true)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-success-500/10 text-success-400 hover:bg-success-500/20 disabled:opacity-50"><Check className="w-3.5 h-3.5" /> Onayla</button>
                      <button disabled={actingId === t.id} onClick={() => review(t.id, false)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-error-500/10 text-error-400 hover:bg-error-500/20 disabled:opacity-50"><X className="w-3.5 h-3.5" /> Reddet</button>
                    </div>
                  )}
                  {t.admin_note && <div className="text-xs text-text-muted mt-1">{t.admin_note}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

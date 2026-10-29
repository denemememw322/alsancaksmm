import { useCallback, useEffect, useState } from 'react';
import { Check, X, Clock, Search, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Badge, NoticeBar, Pager, btnGhost, fmtDate, inputCls, type Notice } from '@/components/ui';

const PAGE = 25;
const LABEL: Record<string, string> = { pending: 'Ödeme bekleniyor', awaiting_review: 'Kontrol bekliyor', approved: 'Ödendi / Tamamlandı', rejected: 'Reddedildi', cancelled: 'İptal' };
const TONE: Record<string, 'warn' | 'brand' | 'ok' | 'bad' | 'muted'> = { pending: 'warn', awaiting_review: 'brand', approved: 'ok', rejected: 'bad', cancelled: 'muted' };

export function depositLabel(d: { status: string; cancel_reason?: string | null }) {
  if (d.status === 'cancelled') return d.cancel_reason === 'expired' ? 'İptal (süre doldu)' : 'İptal';
  return LABEL[d.status] ?? d.status;
}

const left = (iso?: string | null) => {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'süre doldu';
  const m = Math.ceil(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)} sa ${m % 60} dk kaldı` : `${m} dk kaldı`;
};

export default function AdminDeposits() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [users, setUsers] = useState<Record<string, any>>({});
  const [methods, setMethods] = useState<Record<string, any>>({});
  const [events, setEvents] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [filter, setFilter] = useState('open');
  const [provider, setProvider] = useState('');
  const [q, setQ] = useState('');
  const [notice, setNotice] = useState<Notice>(null);

  const load = useCallback(async () => {
    await supabase.rpc('expire_deposit_requests'); // zamanlayıcıya ek güvence: süresi dolanlar listeden önce iptal edilir
    let query = supabase.from('deposit_requests').select('*', { count: 'exact' });
    if (filter === 'open') query = query.in('status', ['pending', 'awaiting_review']);
    else if (filter !== 'all') query = query.eq('status', filter);
    if (provider) query = provider === 'manual' ? query.is('provider', null) : query.eq('provider', provider);
    const t = q.trim().replace(/[%,()]/g, ' ');
    if (t) query = query.ilike('public_id', `%${t}%`);
    const { data, count, error } = await query.order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) setNotice({ ok: false, text: error.message });
    const list = data || [];
    setRows(list); setTotal(count || 0);
    const uids = [...new Set(list.map((r: any) => r.user_id))];
    if (uids.length) {
      const { data: ps } = await supabase.from('profiles').select('user_id,email,username').in('user_id', uids);
      const m: Record<string, any> = {}; (ps || []).forEach((p: any) => (m[p.user_id] = p)); setUsers(m);
    }
    const { data: ms } = await supabase.from('payment_methods').select('id,name,network');
    const mm: Record<string, any> = {}; (ms || []).forEach((x: any) => (mm[x.id] = x)); setMethods(mm);
    const pids = list.map((r: any) => r.public_id);
    if (pids.length) {
      const { data: ev } = await supabase.from('provider_events').select('public_id,provider,event_type,status,error,created_at').in('public_id', pids).order('created_at');
      const em: Record<string, any> = {}; (ev || []).forEach((e: any) => (em[e.public_id] = e)); setEvents(em);
    }
    setLoading(false);
  }, [filter, provider, q, page]);

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);
  useEffect(() => { const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);
  useEffect(() => setPage(0), [filter, provider, q]);

  const review = async (r: any, approve: boolean) => {
    if (approve) {
      const warn = r.provider && r.status === 'pending' ? `\n\n⚠️ ${r.provider.toUpperCase()} henüz ödemeyi doğrulamadı. Ödemenin sağlayıcı panelinde gerçekleştiğinden eminsen onayla.` : '';
      if (!window.confirm(`${r.public_id}: $${Number(r.amount).toFixed(2)} bakiye kullanıcıya yüklensin mi?${warn}`)) return;
    }
    const note = approve ? null : window.prompt('Red nedeni (opsiyonel)');
    if (!approve && note === null) return;
    setActingId(r.id);
    const { data, error } = await supabase.rpc('admin_review_deposit', { p_id: r.id, p_approve: approve, p_note: note });
    setActingId(null);
    if (error || data?.success === false) setNotice({ ok: false, text: error?.message || (data?.error === 'Already processed' ? 'Bu talep zaten işlenmiş (onaylanmış, reddedilmiş veya iptal edilmiş).' : data?.error) });
    else setNotice({ ok: true, text: approve ? `${r.public_id} onaylandı, bakiye yüklendi.` : `${r.public_id} reddedildi.` });
    load();
  };

  const awaiting = rows.filter((r) => r.status === 'awaiting_review').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl sm:text-2xl font-bold text-text-primary">Bakiye Talepleri</h2>
        <div className="flex items-center gap-3"><span className="flex items-center gap-1.5 text-xs text-brand-400"><Clock className="w-3.5 h-3.5" />{awaiting} kontrol bekliyor</span><button className={btnGhost} onClick={load}><RefreshCw className="w-4 h-4" /></button></div>
      </div>
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />
      <div className="flex flex-wrap gap-2">
        {[['open', 'Açık'], ['awaiting_review', 'Kontrol bekleyen'], ['approved', 'Ödendi'], ['cancelled', 'İptal'], ['rejected', 'Reddedildi'], ['all', 'Tümü']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 rounded-lg text-sm ${filter === k ? 'bg-brand-600 text-white' : 'bg-bg-elevated text-text-secondary'}`}>{l}</button>))}
        <select className={`${inputCls} sm:max-w-[150px]`} value={provider} onChange={(e) => setProvider(e.target.value)}>
          <option value="">Tüm yöntemler</option><option value="paytr">PayTR</option><option value="paymos">Paymos</option><option value="mercanpay">MercanPay</option><option value="manual">Manuel</option></select>
        <div className="relative sm:ml-auto flex-1 sm:flex-none min-w-[180px]"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ödeme ID ara" className={`${inputCls} pl-9`} /></div>
      </div>

      <div className="rounded-2xl bg-bg-surface border border-border-subtle overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="border-b border-border-subtle"><tr className="text-text-muted text-xs uppercase">
            <th className="px-4 py-3 text-left">Ödeme ID</th><th className="px-4 py-3 text-left">Kullanıcı</th><th className="px-4 py-3 text-left">Tutar</th><th className="px-4 py-3 text-left">Yöntem</th>
            <th className="px-4 py-3 text-left">Durum</th><th className="px-4 py-3 text-left">Tarih</th><th className="px-4 py-3 text-left">İşlem</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">Yükleniyor...</td></tr>
              : rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">Kayıt yok</td></tr>
              : rows.map((t) => {
                const open = t.status === 'pending' || t.status === 'awaiting_review'; // onaylı/reddedilmiş/iptal: butonlar kapalı
                const ev = events[t.public_id];
                return (
                  <tr key={t.id} className="border-b border-border-subtle last:border-0 align-top">
                    <td className="px-4 py-3 font-mono font-semibold text-text-primary">{t.public_id}</td>
                    <td className="px-4 py-3 text-text-primary break-all">{users[t.user_id]?.email || users[t.user_id]?.username || t.user_id}</td>
                    <td className="px-4 py-3 font-semibold text-text-primary">${Number(t.amount).toFixed(2)}</td>
                    <td className="px-4 py-3 text-text-secondary">{t.provider ? t.provider.toUpperCase() : methods[t.method_id]?.name ?? '-'}{methods[t.method_id]?.network ? ` (${methods[t.method_id].network})` : ''}</td>
                    <td className="px-4 py-3">
                      <Badge tone={TONE[t.status]}>{depositLabel(t)}</Badge>
                      {t.status === 'pending' && t.expires_at && <div className="text-[11px] text-text-muted mt-1">{left(t.expires_at)}</div>}
                      {ev && <div className="text-[11px] text-text-muted mt-1">Sağlayıcı bildirimi: {ev.event_type?.replace('payment.', '')} · {ev.status === 'processed' ? 'doğrulandı' : ev.status}</div>}
                      {t.admin_note && <div className="text-[11px] text-text-muted mt-1 max-w-[260px] break-words">{t.admin_note}</div>}
                    </td>
                    <td className="px-4 py-3 text-text-muted whitespace-nowrap">{fmtDate(t.created_at)}</td>
                    <td className="px-4 py-3">
                      {open ? (
                        <div className="flex items-center gap-1.5">
                          <button disabled={actingId === t.id} onClick={() => review(t, true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-success-500/10 text-success-400 hover:bg-success-500/20 disabled:opacity-50"><Check className="w-3.5 h-3.5" /> Onayla</button>
                          <button disabled={actingId === t.id} onClick={() => review(t, false)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-error-500/10 text-error-400 hover:bg-error-500/20 disabled:opacity-50"><X className="w-3.5 h-3.5" /> Reddet</button>
                        </div>
                      ) : <span className="text-xs text-text-muted">{t.status === 'approved' ? 'Bakiye yüklendi' : 'İşlem yok'}</span>}
                    </td>
                  </tr>);
              })}
          </tbody>
        </table>
      </div>
      <Pager page={page} pageSize={PAGE} total={total} onPage={setPage} />
    </div>
  );
}

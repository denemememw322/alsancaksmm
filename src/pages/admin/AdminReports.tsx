import { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { NoticeBar, btnGhost, inputCls, type Notice } from '@/components/ui';

const money = (n: any) => `$${Number(n || 0).toFixed(2)}`;
const iso = (d: Date) => d.toISOString().slice(0, 10);

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

export default function AdminReports() {
  const [from, setFrom] = useState(iso(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(iso(new Date()));
  const [r, setR] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const load = useCallback(async () => {
    setLoading(true); setNotice(null);
    const end = new Date(to); end.setDate(end.getDate() + 1);
    const { data, error } = await supabase.rpc('admin_report', { p_from: new Date(from).toISOString(), p_to: end.toISOString() });
    setLoading(false);
    if (error || data?.success === false) return setNotice({ ok: false, text: error?.message || data?.error });
    setR(data);
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  const preset = (days: number) => { setFrom(iso(new Date(Date.now() - (days - 1) * 86400000))); setTo(iso(new Date())); };
  const o = r?.orders;
  const profit = o ? Number(o.net) - Number(o.est_cost) : 0;
  const maxRev = Math.max(1, ...((r?.daily || []).map((d: any) => Number(d.revenue || 0))));

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-2xl font-bold text-text-primary">Raporlar</h2>
        <button className={btnGhost} onClick={load}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button></div>
      <NoticeBar notice={notice} />
      <div className="flex flex-wrap items-center gap-2">
        {[7, 30, 90].map((d) => <button key={d} className={btnGhost} onClick={() => preset(d)}>Son {d} gün</button>)}
        <input type="date" className={`${inputCls} max-w-[160px]`} value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        <span className="text-text-muted">–</span>
        <input type="date" className={`${inputCls} max-w-[160px]`} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
      </div>
      {r && (<>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[['Sipariş', o.count], ['Brüt ciro', money(o.gross)], ['İade', money(o.refunded)], ['Net ciro', money(o.net)],
            ['Tahmini maliyet', money(o.est_cost)], ['Tahmini kâr', money(profit)], ['Yeni üye', r.new_users], ['Onaylı yükleme', money((r.deposits || []).reduce((a: number, d: any) => a + Number(d.total), 0))]].map(([l, v]) => (
            <div key={String(l)} className="p-3 sm:p-4 rounded-2xl bg-bg-surface border border-border-subtle"><div className="text-xs text-text-muted">{l}</div><div className="text-lg sm:text-2xl font-bold text-text-primary break-words">{v}</div></div>))}
        </div>
        <p className="text-xs text-text-muted">Maliyet/kâr, sipariş anındaki sağlayıcı maliyetinden hesaplanan tahmindir (maliyeti bilinmeyen manuel hizmetler 0 sayılır).</p>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-bg-surface border border-border-subtle">
            <div className="flex justify-between items-center mb-3"><h3 className="font-semibold text-text-primary">Günlük ciro</h3>
              <button className={btnGhost} onClick={() => downloadCsv(`gunluk-${from}-${to}.csv`, [['Gün', 'Sipariş', 'Net ciro'], ...(r.daily || []).map((d: any) => [d.day, d.orders, d.revenue])])}><Download className="w-4 h-4" /> CSV</button></div>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {(r.daily || []).length === 0 && <div className="text-sm text-text-muted">Veri yok</div>}
              {(r.daily || []).map((d: any) => (<div key={d.day} className="flex items-center gap-2 text-xs">
                <span className="w-20 text-text-muted shrink-0">{d.day}</span>
                <div className="flex-1 h-4 rounded bg-bg-elevated overflow-hidden"><div className="h-full bg-brand-500" style={{ width: `${(Number(d.revenue || 0) / maxRev) * 100}%` }} /></div>
                <span className="w-20 text-right text-text-primary shrink-0">{money(d.revenue)}</span><span className="w-8 text-right text-text-muted">{d.orders}</span></div>))}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-bg-surface border border-border-subtle">
            <div className="flex justify-between items-center mb-3"><h3 className="font-semibold text-text-primary">En çok kazandıran hizmetler</h3>
              <button className={btnGhost} onClick={() => downloadCsv(`hizmetler-${from}-${to}.csv`, [['Hizmet ID', 'Ad', 'Sipariş', 'Net ciro'], ...(r.top_services || []).map((s: any) => [s.service, s.name, s.orders, s.revenue])])}><Download className="w-4 h-4" /> CSV</button></div>
            <div className="space-y-2">{(r.top_services || []).length === 0 && <div className="text-sm text-text-muted">Veri yok</div>}
              {(r.top_services || []).map((s: any) => (<div key={s.service + s.name} className="flex justify-between gap-3 text-sm"><span className="text-text-primary truncate">#{s.service} {s.name}</span><span className="text-text-secondary shrink-0">{s.orders} · {money(s.revenue)}</span></div>))}</div>
          </div>
          <div className="p-4 rounded-2xl bg-bg-surface border border-border-subtle">
            <h3 className="font-semibold text-text-primary mb-3">Sipariş durumları</h3>
            <div className="flex flex-wrap gap-2">{Object.entries(r.by_status || {}).map(([k, v]) => <span key={k} className="px-3 py-1.5 rounded-lg bg-bg-elevated text-sm text-text-primary">{k}: <b>{String(v)}</b></span>)}{Object.keys(r.by_status || {}).length === 0 && <span className="text-sm text-text-muted">Veri yok</span>}</div>
          </div>
          <div className="p-4 rounded-2xl bg-bg-surface border border-border-subtle">
            <h3 className="font-semibold text-text-primary mb-3">Bakiye yüklemeleri</h3>
            <div className="space-y-1 text-sm">{(r.deposits || []).map((d: any) => <div key={d.provider} className="flex justify-between"><span className="text-text-secondary uppercase">{d.provider}</span><span className="text-text-primary">{d.count} işlem · {money(d.total)}</span></div>)}
              {(r.deposits || []).length === 0 && <span className="text-text-muted">Onaylı yükleme yok</span>}</div>
            <div className="flex flex-wrap gap-2 mt-3">{Object.entries(r.deposit_status || {}).map(([k, v]) => <span key={k} className="px-2 py-1 rounded bg-bg-elevated text-xs text-text-secondary">{k}: {String(v)}</span>)}</div>
          </div>
        </div>
      </>)}
    </div>
  );
}

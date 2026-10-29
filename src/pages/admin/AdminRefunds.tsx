import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Badge, NoticeBar, Pager, btnGhost, btnPrimary, fmtDate, type Notice } from '@/components/ui';

const PAGE = 25;
export default function AdminRefunds() {
  const [events, setEvents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [stuck, setStuck] = useState<any[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [orders, setOrders] = useState<Record<string, any>>({});
  const [sum, setSum] = useState({ refunded: 0, partial: 0, canceled: 0 });
  const [notice, setNotice] = useState<Notice>(null);
  const [consistency, setConsistency] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: ev, count } = await supabase.from('order_events').select('*', { count: 'exact' }).gt('refund_amount', 0).order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    setEvents(ev || []); setTotal(count || 0);
    const ids = [...new Set((ev || []).map((e: any) => e.order_id))];
    const { data: st } = await supabase.from('orders').select('*').or('status.eq.Error,status.eq.Canceled,status.eq.Partial').order('updated_at', { ascending: false }).limit(200);
    const stuckList = (st || []).filter((o: any) => o.status === 'Error' && Number(o.refunded_total || 0) < Number(o.charge));
    setStuck(stuckList);
    setSum({ refunded: (st || []).reduce((a: number, o: any) => a + Number(o.refunded_total || 0), 0), partial: (st || []).filter((o: any) => o.status === 'Partial').length, canceled: (st || []).filter((o: any) => o.status === 'Canceled').length });
    const need = [...new Set([...ids, ...stuckList.map((o: any) => o.id)])];
    if (need.length) {
      const { data: os } = await supabase.from('orders').select('id,order_id,user_id,service_name,charge,refunded_total,status,quantity,remains').in('id', need);
      const om: Record<string, any> = {}; (os || []).forEach((o: any) => { om[o.id] = o; }); setOrders(om);
      const uids = [...new Set((os || []).map((o: any) => o.user_id))];
      const { data: ps } = await supabase.from('profiles').select('user_id,email,username').in('user_id', uids);
      const um: Record<string, string> = {}; (ps || []).forEach((p: any) => { um[p.user_id] = p.email || p.username; }); setUsers(um);
    }
  }, [page]);
  useEffect(() => { load(); }, [load]);

  const refund = async (o: any) => {
    if (!window.confirm(`#${o.order_id} siparişi iptal edilip $${(Number(o.charge) - Number(o.refunded_total || 0)).toFixed(4)} kullanıcıya iade edilsin mi?`)) return;
    const { data, error } = await supabase.rpc('admin_set_order_status', { p_order_id: o.id, p_status: 'Canceled' });
    if (error || data?.success === false) return setNotice({ ok: false, text: error?.message || data?.error });
    setNotice({ ok: true, text: `#${o.order_id}: $${Number(data.refund).toFixed(4)} iade edildi.` }); load();
  };
  const check = async () => {
    const { data, error } = await supabase.rpc('verify_ledger_consistency');
    if (error) return setNotice({ ok: false, text: error.message });
    setConsistency((data || []).length === 0 ? '✅ Tüm kullanıcı bakiyeleri finansal defterle birebir tutarlı.' : `⚠️ ${(data || []).length} kullanıcıda bakiye ile defter uyuşmuyor.`);
  };

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-2xl font-bold text-text-primary">İadeler</h2>
        <div className="flex gap-2"><button className={btnGhost} onClick={check}><ShieldCheck className="w-4 h-4" /> Defter tutarlılığını kontrol et</button><button className={btnGhost} onClick={load}><RefreshCw className="w-4 h-4" /></button></div></div>
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />
      {consistency && <div className="text-sm text-text-secondary p-3 rounded-xl bg-bg-surface border border-border-subtle">{consistency}</div>}
      <div className="grid grid-cols-3 gap-3">
        {[['Toplam iade (son 200 kayıt)', `$${sum.refunded.toFixed(2)}`], ['İptal edilen', sum.canceled], ['Kısmi tamamlanan', sum.partial]].map(([l, v]) => (
          <div key={String(l)} className="p-3 sm:p-4 rounded-2xl bg-bg-surface border border-border-subtle"><div className="text-xs text-text-muted">{l}</div><div className="text-lg sm:text-2xl font-bold text-text-primary">{v}</div></div>))}
      </div>

      {stuck.length > 0 && (
        <div className="rounded-2xl bg-warning-500/5 border border-warning-500/20 p-4 space-y-2">
          <div className="text-sm font-medium text-warning-400">İade bekleyen hatalı siparişler (sağlayıcıya iletilemedi, ücret tutuluyor)</div>
          {stuck.map((o) => (<div key={o.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-text-primary">#{o.order_id} · {o.service_name} · ${Number(o.charge).toFixed(4)}</span>
            <button className={btnPrimary} onClick={() => refund(o)}>İptal et ve iade et</button></div>))}
        </div>)}

      <div className="rounded-2xl bg-bg-surface border border-border-subtle overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="border-b border-border-subtle"><tr className="text-text-muted text-xs uppercase"><th className="px-3 py-3 text-left">Tarih</th><th className="px-3 py-3 text-left">Sipariş</th><th className="px-3 py-3 text-left">Kullanıcı</th><th className="px-3 py-3 text-left">Durum</th><th className="px-3 py-3 text-right">İade</th><th className="px-3 py-3 text-right">Toplam iade / Ücret</th><th className="px-3 py-3 text-left">Kaynak</th><th className="px-3 py-3 text-left">İade durumu</th></tr></thead>
          <tbody>
            {events.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-text-muted">İade kaydı yok</td></tr>}
            {events.map((e) => { const o = orders[e.order_id]; const full = o && Number(o.refunded_total) >= Number(o.charge) - 0.00005; return (
              <tr key={e.id} className="border-b border-border-subtle last:border-0">
                <td className="px-3 py-3 text-text-muted whitespace-nowrap">{fmtDate(e.created_at)}</td>
                <td className="px-3 py-3 text-text-primary">#{o?.order_id ?? '?'}<div className="text-xs text-text-muted max-w-[220px] truncate">{o?.service_name}</div></td>
                <td className="px-3 py-3 text-text-secondary">{o ? users[o.user_id] || '-' : '-'}</td>
                <td className="px-3 py-3"><Badge tone={e.to_status === 'Partial' ? 'warn' : 'bad'}>{e.from_status} → {e.to_status}</Badge></td>
                <td className="px-3 py-3 text-right font-semibold text-success-400">+${Number(e.refund_amount).toFixed(4)}</td>
                <td className="px-3 py-3 text-right text-text-secondary">${Number(o?.refunded_total ?? 0).toFixed(4)} / ${Number(o?.charge ?? 0).toFixed(4)}</td>
                <td className="px-3 py-3 text-text-muted">{e.source}</td>
                <td className="px-3 py-3"><Badge tone="ok">Tamamlandı</Badge> {o && !full && <Badge tone="warn">Kısmi</Badge>}</td>
              </tr>); })}
          </tbody>
        </table>
      </div>
      <Pager page={page} pageSize={PAGE} total={total} onPage={setPage} />
      <p className="text-xs text-text-muted">Kayıtlar sipariş olay geçmişi ve finansal defterden gelir; iade tutarları sağlayıcıdan gelen gerçek durumla (otomatik senkron) hesaplanır ve bir sipariş için ücretten fazla iade edilemez.</p>
    </div>
  );
}

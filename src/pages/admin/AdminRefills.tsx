import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Badge, Pager, btnGhost, inputCls, fmtDate } from '@/components/ui';

const PAGE = 25;
const tone = (s: string) => (s === 'completed' ? 'ok' : s === 'pending' ? 'warn' : 'bad') as 'ok' | 'warn' | 'bad';
const label: Record<string, string> = { pending: 'Beklemede', completed: 'Tamamlandı', failed: 'Başarısız', rejected: 'Reddedildi' };

export default function AdminRefills() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [action, setAction] = useState('');
  const [status, setStatus] = useState('');
  const [orders, setOrders] = useState<Record<string, any>>({});

  const load = useCallback(async () => {
    let q = supabase.from('order_actions').select('*', { count: 'exact' });
    if (action) q = q.eq('action', action);
    if (status) q = q.eq('status', status);
    const { data, count } = await q.order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    setRows(data || []); setTotal(count || 0);
    const ids = [...new Set((data || []).map((r: any) => r.order_id))];
    if (ids.length) { const { data: os } = await supabase.from('orders').select('id,order_id,service_name,status').in('id', ids); const m: Record<string, any> = {}; (os || []).forEach((o: any) => (m[o.id] = o)); setOrders(m); }
  }, [action, status, page]);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  useEffect(() => setPage(0), [action, status]);

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-2xl font-bold text-text-primary">Refill ve İptal Talepleri</h2><button className={btnGhost} onClick={load}><RefreshCw className="w-4 h-4" /></button></div>
      <div className="flex flex-wrap gap-2">
        <select className={`${inputCls} sm:max-w-[160px]`} value={action} onChange={(e) => setAction(e.target.value)}><option value="">Tümü</option><option value="refill">Refill</option><option value="cancel">İptal</option></select>
        <select className={`${inputCls} sm:max-w-[160px]`} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Tüm durumlar</option>{Object.entries(label).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      <div className="rounded-2xl bg-bg-surface border border-border-subtle overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="border-b border-border-subtle"><tr className="text-text-muted text-xs uppercase"><th className="px-3 py-3 text-left">Tarih</th><th className="px-3 py-3 text-left">İşlem</th><th className="px-3 py-3 text-left">Sipariş</th><th className="px-3 py-3 text-left">Refill ID</th><th className="px-3 py-3 text-left">Sonuç</th><th className="px-3 py-3 text-left">Sağlayıcı yanıtı</th><th className="px-3 py-3 text-left">Kaynak</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">Kayıt yok</td></tr>}
            {rows.map((r) => (<tr key={r.id} className="border-b border-border-subtle last:border-0">
              <td className="px-3 py-3 text-text-muted whitespace-nowrap">{fmtDate(r.created_at)}</td>
              <td className="px-3 py-3"><Badge tone={r.action === 'refill' ? 'brand' : 'muted'}>{r.action === 'refill' ? 'Refill' : 'İptal'}</Badge></td>
              <td className="px-3 py-3 text-text-primary">#{orders[r.order_id]?.order_id ?? '?'}<div className="text-xs text-text-muted max-w-[200px] truncate">{orders[r.order_id]?.service_name}</div></td>
              <td className="px-3 py-3 font-mono text-text-secondary">{r.provider_ref || '-'}</td>
              <td className="px-3 py-3"><Badge tone={tone(r.status)}>{label[r.status]}</Badge></td>
              <td className="px-3 py-3 text-xs text-text-muted max-w-[260px] break-words">{r.provider_status || r.response || '-'}</td>
              <td className="px-3 py-3 text-text-muted">{r.source}</td></tr>))}
          </tbody>
        </table>
      </div>
      <Pager page={page} pageSize={PAGE} total={total} onPage={setPage} />
    </div>
  );
}

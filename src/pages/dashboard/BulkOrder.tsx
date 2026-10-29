import { useMemo, useState } from 'react';
import { Layers, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { forwardOrders } from '@/lib/providerApi';
import { useAuth } from '@/lib/auth';
import { parseBulk } from '@/lib/bulk';

export default function BulkOrder() {
  const { refreshProfile } = useAuth();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<any | null>(null);
  const [batchRef, setBatchRef] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parseBulk(text), [text]);
  const valid = parsed.filter((p) => p.row);
  const invalid = parsed.filter((p) => p.error);

  const submit = async () => {
    if (!valid.length || invalid.length) return;
    setBusy(true); setError(null); setReport(null);
    // aynı batchRef ile tekrar gönderim çift sipariş/çift tahsilat oluşturmaz (satır başına idempotency)
    const { data, error: err } = await supabase.rpc('place_orders_bulk', { p_items: valid.map((v) => v.row), p_batch_ref: batchRef });
    if (err || data?.success === false) { setBusy(false); return setError(err?.message || data?.error); }
    const created = (data.results as any[]).filter((r) => r.result?.success && !r.result?.duplicate).map((r) => r.result.order_uuid);
    for (let i = 0; i < created.length; i += 50) { try { await forwardOrders(created.slice(i, i + 50)); } catch { /* zamanlayıcı yedek olarak iletir */ } }
    setReport(data); setBusy(false); setBatchRef(crypto.randomUUID());
    await refreshProfile();
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div><h1 className="font-display text-2xl font-bold text-text-primary flex items-center gap-2"><Layers className="w-6 h-6" /> Bulk Order</h1>
        <p className="text-text-secondary text-sm mt-1">Her satıra bir sipariş yaz: <code className="px-1.5 py-0.5 rounded bg-bg-elevated">hizmet_id | link | miktar</code></p></div>

      <div className="p-4 rounded-2xl bg-bg-surface border border-border-subtle space-y-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={9} spellCheck={false}
          placeholder={'101997 | https://instagram.com/p/abc | 1000\n101995 | https://youtu.be/xyz | 0 | harika;süper video;beğendim'}
          className="w-full px-3 py-2.5 rounded-xl bg-bg-elevated border border-border-default text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500 font-mono text-sm" />
        <p className="text-xs text-text-muted">Custom Comments hizmetlerinde 4. alana yorumları <b>;</b> ile ayırarak yaz (adet yorum sayısı olur). En fazla 200 satır. Her satır bağımsız işlenir.</p>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-text-secondary">Toplam: <b className="text-text-primary">{parsed.length}</b></span>
          <span className="text-success-400">Geçerli: <b>{valid.length}</b></span>
          <span className={invalid.length ? 'text-error-400' : 'text-text-muted'}>Hatalı: <b>{invalid.length}</b></span>
        </div>
        {invalid.length > 0 && (
          <div className="rounded-xl bg-error-500/5 border border-error-500/20 p-3 space-y-1 max-h-40 overflow-y-auto">
            {invalid.map((p) => <div key={p.line} className="text-xs text-error-400">Satır {p.line}: {p.error}</div>)}
          </div>)}
        {error && <div className="text-sm text-error-400 break-words">{error}</div>}
        <button onClick={submit} disabled={busy || !valid.length || invalid.length > 0 || parsed.length > 200}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold inline-flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} {valid.length} siparişi gönder
        </button>
        {invalid.length > 0 && <p className="text-xs text-text-muted">Hatalı satırları düzelt ya da sil, sonra gönder.</p>}
      </div>

      {report && (
        <div className="p-4 rounded-2xl bg-bg-surface border border-border-subtle space-y-3">
          <div className="flex flex-wrap gap-4 text-sm"><span className="text-success-400">Oluşan: <b>{report.created}</b></span><span className="text-error-400">Başarısız: <b>{report.failed}</b></span><span className="text-text-secondary">Toplam ücret: <b>${Number(report.total_charge).toFixed(2)}</b></span></div>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {(report.results as any[]).map((r) => (
              <div key={r.line} className="flex items-start gap-2 text-sm">
                {r.result.success ? <CheckCircle2 className="w-4 h-4 text-success-400 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 text-error-400 mt-0.5 shrink-0" />}
                <span className="text-text-secondary">Satır {r.line}: {r.result.success ? `Order #${r.result.order_id} · $${Number(r.result.charge).toFixed(2)}${r.result.duplicate ? ' (daha önce oluşturulmuştu)' : ''}` : (r.result.error || 'Hata')}</span>
              </div>))}
          </div>
        </div>)}
    </div>
  );
}

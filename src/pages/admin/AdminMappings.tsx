import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, ShieldCheck, Loader2, ArrowRight, Link2Off } from 'lucide-react';
import { supabase, type Service } from '@/lib/supabase';
import { providerApi, type ProviderService } from '@/lib/providerApi';
import { Modal, NoticeBar, Pager, Badge, btnDanger, btnGhost, btnPrimary, inputCls, type Notice } from '@/components/ui';

type Provider = { id: string; name: string };
const PAGE = 25;

export default function AdminMappings() {
  const [rows, setRows] = useState<Service[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');
  const [fProv, setFProv] = useState('');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [edit, setEdit] = useState<Service | null>(null);
  const [prov, setProv] = useState('');
  const [orig, setOrig] = useState('');
  const [state, setState] = useState<{ s: 'idle' | 'busy' | 'ok' | 'bad'; text?: string; svc?: ProviderService }>({ s: 'idle' });
  const [saving, setSaving] = useState(false);
  const pname = useMemo(() => Object.fromEntries(providers.map((p) => [p.id, p.name])), [providers]);

  useEffect(() => { supabase.from('api_providers').select('id,name').order('name').then(({ data }) => setProviders((data as Provider[]) || [])); }, []);
  const load = useCallback(async () => {
    let query = supabase.from('services').select('*', { count: 'exact' }).eq('source', 'api');
    const t = q.trim();
    if (t) query = /^\d+$/.test(t) ? query.or(`service_id.eq.${t},original_id.eq.${t}`) : query.ilike('name', `%${t.replace(/[%,()]/g, ' ')}%`);
    if (fProv) query = query.eq('provider_id', fProv);
    const { data, count, error } = await query.order('service_id').range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) setNotice({ ok: false, text: error.message });
    setRows((data as Service[]) || []); setTotal(count || 0);
  }, [q, fProv, page]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => setPage(0), [q, fProv]);

  const open = (s: Service) => { setEdit(s); setProv(s.provider_id || ''); setOrig(s.original_id || ''); setState({ s: 'idle' }); };
  const verify = async () => {
    if (!prov || !orig.trim()) return setState({ s: 'bad', text: 'Sağlayıcı ve servis ID gir.' });
    setState({ s: 'busy' });
    try {
      const r = await providerApi({ action: 'validate', provider_id: prov, service_id: orig.trim() });
      setState(r.found ? { s: 'ok', svc: r.service } : { s: 'bad', text: r.message });
    } catch (e: any) { setState({ s: 'bad', text: e.message }); }
  };
  const save = async () => {
    if (!edit || state.s !== 'ok' || !state.svc) return;
    setSaving(true);
    const v = state.svc;
    const { data, error } = await supabase.rpc('admin_set_service_mapping', { p_service: edit.id, p_provider: prov, p_original: orig.trim(),
      p_meta: { rate: v.rate, min: v.min, max: v.max, refill: v.refill, cancel: v.cancel, type: v.type, category: v.category } });
    setSaving(false);
    if (error || data?.success === false) return setNotice({ ok: false, text: error?.message || data?.error });
    setNotice({ ok: true, text: `#${edit.service_id}: eşleme ${data.old_original || '-'} → ${data.new_original} olarak güncellendi. Panel hizmet numarası değişmedi, reseller'lar aynı ID'yi kullanmaya devam eder.` });
    setEdit(null); load();
  };
  const unlink = async (s: Service) => {
    if (!window.confirm(`#${s.service_id} hizmetinin sağlayıcı bağlantısı kaldırılsın mı? Hizmet manuel olur (yeni siparişler sağlayıcıya gitmez).`)) return;
    const { data, error } = await supabase.rpc('admin_set_service_mapping', { p_service: s.id, p_provider: null, p_original: null, p_meta: null });
    if (error || data?.success === false) return setNotice({ ok: false, text: error?.message || data?.error });
    setNotice({ ok: true, text: `#${s.service_id} manuel hizmete çevrildi.` }); load();
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <h2 className="text-2xl font-bold text-text-primary">Hizmet ID Eşleştirme</h2>
      <p className="text-sm text-text-secondary">Panel hizmet numarası (reseller'ların kullandığı ID) sabit kalır; yalnızca arkasındaki sağlayıcı ve sağlayıcı servis ID'si değişir. Eski siparişler kendi kayıtlarıyla korunur.</p>
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input className={`${inputCls} pl-9`} placeholder="Panel ID, sağlayıcı ID veya ad" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className={`${inputCls} sm:max-w-[220px]`} value={fProv} onChange={(e) => setFProv(e.target.value)}><option value="">Tüm sağlayıcılar</option>{providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </div>
      <div className="rounded-2xl bg-bg-surface border border-border-subtle overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="border-b border-border-subtle"><tr className="text-text-muted text-xs uppercase">
            <th className="px-3 py-3 text-left">Panel ID</th><th className="px-3 py-3 text-left">Hizmet</th><th className="px-3 py-3 text-left">Sağlayıcı</th><th className="px-3 py-3 text-left">Sağlayıcı servis ID</th><th className="px-3 py-3"></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">API'ye bağlı hizmet yok</td></tr>}
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-border-subtle last:border-0">
                <td className="px-3 py-3 font-mono text-text-primary">#{s.service_id}</td>
                <td className="px-3 py-3 max-w-sm text-text-primary break-words">{s.name}{s.provider_missing_at && <> <Badge tone="bad">Sağlayıcıda yok</Badge></>}</td>
                <td className="px-3 py-3 text-text-secondary">{s.provider_id ? pname[s.provider_id] || '?' : '-'}</td>
                <td className="px-3 py-3 font-mono text-text-secondary">{s.original_id}</td>
                <td className="px-3 py-3"><div className="flex gap-1.5 justify-end"><button onClick={() => open(s)} className={btnGhost}>Değiştir</button>
                  <button onClick={() => unlink(s)} title="Manuel yap" className="p-2 rounded-lg bg-bg-elevated text-text-muted"><Link2Off className="w-4 h-4" /></button></div></td>
              </tr>))}
          </tbody>
        </table>
      </div>
      <Pager page={page} pageSize={PAGE} total={total} onPage={setPage} />

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit ? `Eşlemeyi değiştir · #${edit.service_id}` : ''} wide>
        {edit && (
          <div className="space-y-4">
            <div className="text-sm text-text-secondary break-words">{edit.name}</div>
            <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-3 items-center">
              <div className="p-3 rounded-xl bg-bg-elevated text-sm"><div className="text-xs text-text-muted mb-1">ÖNCE</div>
                <div className="text-text-primary">{edit.provider_id ? pname[edit.provider_id] : '-'}</div><div className="font-mono text-text-secondary">servis {edit.original_id || '-'}</div>
                <div className="text-xs text-text-muted mt-1">maliyet ${edit.provider_rate ?? '-'} · min {edit.min_order} · max {edit.max_order}</div></div>
              <ArrowRight className="w-5 h-5 text-text-muted hidden sm:block mx-auto" />
              <div className="p-3 rounded-xl bg-bg-elevated text-sm"><div className="text-xs text-text-muted mb-1">SONRA</div>
                {state.s === 'ok' && state.svc ? <><div className="text-text-primary">{pname[prov]}</div><div className="font-mono text-success-400">servis {state.svc.id}</div>
                  <div className="text-xs text-text-muted mt-1">{state.svc.name}<br />maliyet ${state.svc.rate} · min {state.svc.min} · max {state.svc.max} · refill {state.svc.refill ? 'var' : 'yok'} · iptal {state.svc.cancel ? 'var' : 'yok'}</div></>
                  : <div className="text-text-muted text-xs">Doğrulama bekleniyor</div>}</div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <select className={inputCls} value={prov} onChange={(e) => { setProv(e.target.value); setState({ s: 'idle' }); }}><option value="">Sağlayıcı seç</option>{providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <input className={inputCls} placeholder="Yeni sağlayıcı servis ID" value={orig} onChange={(e) => { setOrig(e.target.value); setState({ s: 'idle' }); }} />
              <button onClick={verify} disabled={state.s === 'busy'} className={btnGhost}>{state.s === 'busy' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Doğrula</button>
            </div>
            {state.s === 'bad' && <div className="text-sm text-error-400 break-words">❌ {state.text} Doğrulanmayan eşleme kaydedilmez.</div>}
            <div className="flex justify-end gap-2"><button className={btnGhost} onClick={() => setEdit(null)}>Vazgeç</button>
              <button className={btnPrimary} disabled={state.s !== 'ok' || saving} onClick={save}>{saving && <Loader2 className="w-4 h-4 animate-spin" />} Eşlemeyi kaydet</button></div>
            <div className="text-xs text-text-muted">Yeni sağlayıcı maliyeti mevcut satış fiyatından yüksekse kayıt reddedilir (zararına satış engeli). Devam eden siparişler eski sağlayıcıda kalır.</div>
          </div>
        )}
      </Modal>
    </div>
  );
}

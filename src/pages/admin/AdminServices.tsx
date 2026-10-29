import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, ShieldCheck, Loader2, Wand2 } from 'lucide-react';
import { supabase, type Service, CUSTOM_TYPES, SERVICE_TYPES } from '@/lib/supabase';
import { providerApi, type ProviderService } from '@/lib/providerApi';
import { Badge, Modal, NoticeBar, Pager, btnDanger, btnGhost, btnPrimary, inputCls, type Notice } from '@/components/ui';

type Provider = { id: string; name: string; enabled: boolean };
const PAGE = 25;

type Form = {
  id: string | null; service_id: string; name: string; description: string; category: string; newCategory: string;
  provider_id: string; original_id: string; rate: string; min_order: string; max_order: string; is_active: boolean;
  custom: boolean; service_type: string; refill_enabled: boolean; refill_days: string; cancel_enabled: boolean;
  pricing_mode: string; pricing_value: string; min_profit: string; min_price: string; round_to: string;
  provider_rate: number | null; orig_provider_id: string; orig_original_id: string;
};

const blank = (): Form => ({
  id: null, service_id: '', name: '', description: '', category: 'Kategorisiz', newCategory: '', provider_id: '', original_id: '', rate: '',
  min_order: '10', max_order: '10000', is_active: true, custom: false, service_type: 'Default', refill_enabled: false, refill_days: '30',
  cancel_enabled: false, pricing_mode: 'manual', pricing_value: '', min_profit: '0', min_price: '0', round_to: '0',
  provider_rate: null, orig_provider_id: '', orig_original_id: '',
});

export default function AdminServices() {
  const [rows, setRows] = useState<Service[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [fCat, setFCat] = useState('');
  const [fSource, setFSource] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCat, setBulkCat] = useState('');
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [verify, setVerify] = useState<{ state: 'idle' | 'busy' | 'ok' | 'bad'; text?: string; svc?: ProviderService }>({ state: 'idle' });

  const provName = useMemo(() => Object.fromEntries(providers.map((p) => [p.id, p.name])), [providers]);

  const loadMeta = useCallback(async () => {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from('api_providers').select('id,name,enabled').order('name'),
      supabase.from('categories').select('name').order('sort_order').order('name'),
    ]);
    setProviders((p as Provider[]) || []);
    setCats((c || []).map((x: any) => x.name));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('services').select('*', { count: 'exact' });
    const term = q.trim();
    if (term) {
      const safe = term.replace(/[%,()]/g, ' ');
      query = /^\d+$/.test(term) ? query.or(`service_id.eq.${term},name.ilike.%${safe}%,original_id.eq.${term}`) : query.or(`name.ilike.%${safe}%,category.ilike.%${safe}%`);
    }
    if (fCat) query = query.eq('category', fCat);
    if (fSource === 'manual') query = query.eq('source', 'manual').eq('service_type', 'Default');
    if (fSource === 'api') query = query.eq('source', 'api');
    if (fSource === 'custom') query = query.neq('service_type', 'Default');
    if (fStatus === 'active') query = query.eq('is_active', true);
    if (fStatus === 'inactive') query = query.eq('is_active', false);
    const { data, count, error } = await query.order('service_id').range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) setNotice({ ok: false, text: `Hizmetler yüklenemedi: ${error.message}` });
    setRows((data as Service[]) || []);
    setTotal(count || 0);
    setLoading(false);
  }, [q, fCat, fSource, fStatus, page]);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { setPage(0); }, [q, fCat, fSource, fStatus]);

  const openEdit = (s: Service) => setForm({
    id: s.id, service_id: String(s.service_id), name: s.name, description: s.description || '', category: s.category, newCategory: '',
    provider_id: s.provider_id || '', original_id: s.original_id || '', rate: String(s.rate_per_1000), min_order: String(s.min_order), max_order: String(s.max_order),
    is_active: s.is_active, custom: (s.service_type || 'Default') !== 'Default', service_type: s.service_type || 'Default',
    refill_enabled: !!s.refill_enabled, refill_days: String(s.refill_days ?? 0), cancel_enabled: !!s.cancel_enabled,
    pricing_mode: s.pricing_mode || 'manual', pricing_value: s.pricing_value != null ? String(s.pricing_value) : '', min_profit: String(s.min_profit ?? 0),
    min_price: String(s.min_price ?? 0), round_to: String(s.round_to ?? 0), provider_rate: s.provider_rate ?? null,
    orig_provider_id: s.provider_id || '', orig_original_id: s.original_id || '',
  });
  const openNew = (kind: 'manual' | 'custom' | 'api') => {
    const f = blank();
    if (kind === 'custom') { f.custom = true; f.service_type = 'Custom Comments'; f.min_order = '1'; }
    if (kind === 'api') f.provider_id = providers.find((p) => p.enabled)?.id || '';
    setVerify({ state: 'idle' });
    setForm(f);
  };
  useEffect(() => { if (form) setVerify({ state: 'idle' }); }, [form?.id]);

  const doVerify = async () => {
    if (!form?.provider_id || !form.original_id.trim()) return setVerify({ state: 'bad', text: 'Önce sağlayıcı ve sağlayıcı servis ID gir.' });
    setVerify({ state: 'busy' });
    try {
      const r = await providerApi({ action: 'validate', provider_id: form.provider_id, service_id: form.original_id.trim() });
      if (!r.found) return setVerify({ state: 'bad', text: r.message });
      setVerify({ state: 'ok', svc: r.service as ProviderService });
    } catch (e: any) { setVerify({ state: 'bad', text: e.message }); }
  };
  const fillFromVerified = () => {
    const v = verify.svc; if (!v || !form) return;
    setForm({ ...form, name: form.name || v.name, min_order: String(v.min || form.min_order), max_order: String(v.max || form.max_order),
      refill_enabled: v.refill, cancel_enabled: v.cancel, service_type: v.type || 'Default', custom: (v.type || 'Default') !== 'Default',
      provider_rate: v.rate });
  };

  const save = async () => {
    if (!form) return;
    setNotice(null);
    const name = form.name.trim();
    const category = (form.newCategory.trim() || form.category || 'Kategorisiz').trim();
    const rate = Number(form.rate), min = parseInt(form.min_order), max = parseInt(form.max_order), days = parseInt(form.refill_days || '0');
    if (!name) return setNotice({ ok: false, text: 'Hizmet adı gerekli.' });
    if (!(rate > 0)) return setNotice({ ok: false, text: 'Rate ($/1000) 0\'dan büyük olmalı.' });
    if (!(min >= 1) || !(max >= min)) return setNotice({ ok: false, text: 'Minimum ve maksimum miktar geçersiz (max ≥ min ≥ 1).' });
    if (form.refill_enabled && !(days >= 0)) return setNotice({ ok: false, text: 'Refill garanti süresi 0 (lifetime) veya pozitif gün olmalı.' });
    const mappingChanged = form.provider_id !== form.orig_provider_id || form.original_id.trim() !== form.orig_original_id;
    if (form.provider_id && !form.original_id.trim()) return setNotice({ ok: false, text: 'API hizmeti için sağlayıcı servis ID gerekli.' });
    if (form.provider_id && mappingChanged && (verify.state !== 'ok')) return setNotice({ ok: false, text: 'Sağlayıcı eşlemesini kaydetmeden önce "Doğrula" ile servisin gerçekten var olduğunu doğrula.' });

    setSaving(true);
    try {
      if (!cats.includes(category)) {
        const { error } = await supabase.from('categories').insert({ name: category, sort_order: 100 });
        if (error && !/duplicate|unique/i.test(error.message)) throw new Error(`Kategori oluşturulamadı: ${error.message}`);
      }
      const base: Record<string, unknown> = {
        name, description: form.description.trim() || null, category, platform: category, min_order: min, max_order: max,
        is_active: form.is_active, service_type: form.custom || form.service_type !== 'Default' ? (form.service_type === 'Default' ? 'Custom Comments' : form.service_type) : 'Default',
        refill_enabled: form.refill_enabled, refill_days: form.refill_enabled ? days : 0, cancel_enabled: form.cancel_enabled,
        pricing_mode: form.pricing_mode, pricing_value: form.pricing_value === '' ? null : Number(form.pricing_value),
        min_profit: Number(form.min_profit) || 0, min_price: Number(form.min_price) || 0, round_to: Number(form.round_to) || 0,
      };
      let id = form.id;
      if (!id) {
        const ins: Record<string, unknown> = { ...base, price: rate, rate_per_1000: rate, type: form.provider_id ? 'API' : 'Manual', avg_time: 'Hızlı', source: form.provider_id ? 'api' : 'manual' };
        if (form.service_id.trim()) ins.service_id = parseInt(form.service_id);
        if (form.provider_id) { ins.provider_id = form.provider_id; ins.original_id = form.original_id.trim(); }
        const { data, error } = await supabase.from('services').insert(ins).select('id').single();
        if (error) throw new Error(error.message.includes('services_service_id') ? 'Bu hizmet numarası zaten kullanılıyor.' : error.message.includes('services_provider_original') ? 'Bu sağlayıcı servisi zaten başka bir hizmete bağlı.' : error.message);
        id = data.id;
        // yeni API hizmeti için veritabanı varsayılan satış fiyatını (maliyet × çarpan) uygular; yöneticinin yazdığı rate'i yeniden uygula
        if (form.provider_id) {
          const { error: e2 } = await supabase.from('services').update({ rate_per_1000: rate, price: rate }).eq('id', id);
          if (e2) throw new Error(`Hizmet eklendi ama rate ayarlanamadı: ${e2.message}`);
        }
      } else {
        if (mappingChanged) {
          const meta = verify.svc ? { rate: verify.svc.rate, min: verify.svc.min, max: verify.svc.max, refill: verify.svc.refill, cancel: verify.svc.cancel, type: verify.svc.type, category: verify.svc.category } : null;
          const { data: r, error } = await supabase.rpc('admin_set_service_mapping', { p_service: id, p_provider: form.provider_id || null, p_original: form.original_id.trim() || null, p_meta: meta });
          if (error) throw new Error(error.message);
          if (r?.success === false) throw new Error(r.error);
        }
        const upd = { ...base, price: rate, rate_per_1000: rate };
        const { error } = await supabase.from('services').update(upd).eq('id', id);
        if (error) throw new Error(error.message);
      }
      setForm(null);
      setNotice({ ok: true, text: form.id ? `Hizmet güncellendi${mappingChanged ? ' (panel hizmet numarası değişmedi, yalnızca sağlayıcı eşlemesi güncellendi)' : ''}.` : 'Hizmet eklendi.' });
      loadMeta(); load();
    } catch (e: any) {
      setNotice({ ok: false, text: e.message });
    }
    setSaving(false);
  };

  const remove = async (s: Service) => {
    const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('service_id', s.id);
    const extra = count ? `\n\nBu hizmetin ${count} siparişi var. Siparişler ve finansal kayıtlar korunur (hizmet adı ve sağlayıcı bilgisi siparişte saklı), hizmet katalogdan ve API'den kalkar.` : '';
    if (!window.confirm(`#${s.service_id} "${s.name}" kalıcı olarak silinsin mi?${extra}`)) return;
    const { data, error } = await supabase.rpc('admin_delete_service', { p_id: s.id });
    if (error || data?.success === false) return setNotice({ ok: false, text: `Silinemedi: ${error?.message || data?.error}` });
    setNotice({ ok: true, text: `#${s.service_id} silindi${data.orders_kept ? ` (${data.orders_kept} sipariş korundu)` : ''}.` });
    setSelected((p) => { const n = new Set(p); n.delete(s.id); return n; });
    load();
  };

  const toggleActive = async (s: Service) => {
    const { error } = await supabase.from('services').update({ is_active: !s.is_active }).eq('id', s.id);
    if (error) return setNotice({ ok: false, text: error.message });
    setRows((r) => r.map((x) => (x.id === s.id ? { ...x, is_active: !s.is_active } : x)));
  };

  const bulk = async (kind: 'move' | 'on' | 'off' | 'delete') => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (kind === 'delete') {
      if (!window.confirm(`${ids.length} hizmet kalıcı olarak silinsin mi? (Siparişleri korunur)`)) return;
      let ok = 0, fail = 0;
      for (const id of ids) { const { data } = await supabase.rpc('admin_delete_service', { p_id: id }); data?.success ? ok++ : fail++; }
      setNotice({ ok: fail === 0, text: `${ok} hizmet silindi${fail ? `, ${fail} silinemedi` : ''}.` });
    } else if (kind === 'move') {
      const cat = bulkCat.trim();
      if (!cat) return setNotice({ ok: false, text: 'Hedef kategori seç veya yaz.' });
      if (!cats.includes(cat)) await supabase.from('categories').insert({ name: cat, sort_order: 100 });
      const { error } = await supabase.from('services').update({ category: cat, platform: cat }).in('id', ids);
      setNotice(error ? { ok: false, text: error.message } : { ok: true, text: `${ids.length} hizmet "${cat}" kategorisine taşındı.` });
    } else {
      const { error } = await supabase.from('services').update({ is_active: kind === 'on' }).in('id', ids);
      setNotice(error ? { ok: false, text: error.message } : { ok: true, text: `${ids.length} hizmet ${kind === 'on' ? 'aktif' : 'pasif'} yapıldı.` });
    }
    setSelected(new Set()); loadMeta(); load();
  };

  const kindBadge = (s: Service) => (
    <>
      {s.source === 'api' ? <Badge tone="brand">API{s.provider_id && provName[s.provider_id] ? ` · ${provName[s.provider_id]}` : ''}</Badge> : <Badge>Manuel</Badge>}
      {(s.service_type || 'Default') !== 'Default' && <Badge tone="warn">{s.service_type === 'Custom Comments' ? 'Custom' : s.service_type}</Badge>}
      {s.provider_missing_at && <Badge tone="bad">Sağlayıcıda yok</Badge>}
    </>
  );

  const profit = (s: Service) => (s.provider_rate ? `${(((s.rate_per_1000 - s.provider_rate) / s.provider_rate) * 100).toFixed(0)}%` : '-');
  const f = form;
  const set = (patch: Partial<Form>) => setForm((p) => (p ? { ...p, ...patch } : p));

  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-bold text-text-primary">Hizmetler</h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => openNew('manual')} className={btnPrimary}><Plus className="w-4 h-4" /> Manuel Hizmet</button>
          <button onClick={() => openNew('custom')} className={btnGhost}><Plus className="w-4 h-4" /> Custom Hizmet</button>
          <button onClick={() => openNew('api')} className={btnGhost}><Plus className="w-4 h-4" /> API Hizmeti</button>
        </div>
      </div>

      <NoticeBar notice={notice} onClose={() => setNotice(null)} />

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input className={`${inputCls} pl-9`} placeholder="ID, ad veya kategori ara..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className={`${inputCls} sm:max-w-[200px]`} value={fCat} onChange={(e) => setFCat(e.target.value)}>
          <option value="">Tüm kategoriler</option>{cats.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className={`${inputCls} sm:max-w-[150px]`} value={fSource} onChange={(e) => setFSource(e.target.value)}>
          <option value="">Tüm türler</option><option value="manual">Manuel</option><option value="api">API</option><option value="custom">Custom</option>
        </select>
        <select className={`${inputCls} sm:max-w-[140px]`} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">Tüm durumlar</option><option value="active">Aktif</option><option value="inactive">Pasif</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-brand-500/10 border border-brand-500/20">
          <span className="text-sm text-text-primary">{selected.size} seçili</span>
          <input list="svc-cats" className={`${inputCls} max-w-[200px]`} placeholder="Kategori" value={bulkCat} onChange={(e) => setBulkCat(e.target.value)} />
          <datalist id="svc-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
          <button className={btnGhost} onClick={() => bulk('move')}>Kategoriye taşı</button>
          <button className={btnGhost} onClick={() => bulk('on')}>Aktif yap</button>
          <button className={btnGhost} onClick={() => bulk('off')}>Pasif yap</button>
          <button className={btnDanger} onClick={() => bulk('delete')}><Trash2 className="w-4 h-4" /> Sil</button>
          <button className="text-xs text-text-muted ml-auto" onClick={() => setSelected(new Set())}>Seçimi temizle</button>
        </div>
      )}

      <div className="rounded-2xl bg-bg-surface border border-border-subtle overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="border-b border-border-subtle">
            <tr className="text-text-muted text-xs uppercase">
              <th className="px-3 py-3 w-8"><input type="checkbox" checked={rows.length > 0 && rows.every((r) => selected.has(r.id))}
                onChange={(e) => setSelected((p) => { const n = new Set(p); rows.forEach((r) => (e.target.checked ? n.add(r.id) : n.delete(r.id))); return n; })} /></th>
              <th className="px-3 py-3 text-left">ID</th><th className="px-3 py-3 text-left">Hizmet</th><th className="px-3 py-3 text-left">Kategori</th>
              <th className="px-3 py-3 text-right">Rate</th><th className="px-3 py-3 text-right">Maliyet</th><th className="px-3 py-3 text-right">Min/Max</th>
              <th className="px-3 py-3 text-left">Durum</th><th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={9} className="px-4 py-8 text-center text-text-muted">Yükleniyor...</td></tr>
              : rows.length === 0 ? <tr><td colSpan={9} className="px-4 py-8 text-center text-text-muted">Hizmet yok</td></tr>
              : rows.map((s) => (
                <tr key={s.id} className="border-b border-border-subtle last:border-0 align-top">
                  <td className="px-3 py-3"><input type="checkbox" checked={selected.has(s.id)} onChange={() => setSelected((p) => { const n = new Set(p); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; })} /></td>
                  <td className="px-3 py-3 font-mono text-text-primary">#{s.service_id}</td>
                  <td className="px-3 py-3 max-w-md"><div className="text-text-primary break-words">{s.name}</div><div className="flex flex-wrap gap-1 mt-1">{kindBadge(s)}</div></td>
                  <td className="px-3 py-3 text-text-secondary">{s.category}</td>
                  <td className="px-3 py-3 text-right text-text-primary">${Number(s.rate_per_1000).toFixed(4)}</td>
                  <td className="px-3 py-3 text-right text-text-muted">{s.provider_rate ? `$${Number(s.provider_rate).toFixed(4)}` : '-'}<div className="text-[11px]">{profit(s)}</div></td>
                  <td className="px-3 py-3 text-right text-text-secondary whitespace-nowrap">{s.min_order}–{s.max_order}</td>
                  <td className="px-3 py-3"><button onClick={() => toggleActive(s)}><Badge tone={s.is_active ? 'ok' : 'bad'}>{s.is_active ? 'Aktif' : 'Pasif'}</Badge></button></td>
                  <td className="px-3 py-3"><div className="flex gap-1.5 justify-end">
                    <button onClick={() => openEdit(s)} className="p-2 rounded-lg bg-bg-elevated text-text-secondary"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(s)} className="p-2 rounded-lg bg-error-500/10 text-error-400"><Trash2 className="w-4 h-4" /></button>
                  </div></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} pageSize={PAGE} total={total} onPage={setPage} />

      <Modal open={!!f} onClose={() => setForm(null)} wide title={f?.id ? `Hizmeti Düzenle · #${f.service_id}` : 'Yeni Hizmet'}>
        {f && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><label className="text-xs text-text-muted">Hizmet adı</label><input className={inputCls} value={f.name} onChange={(e) => set({ name: e.target.value })} /></div>
              {!f.id && <div><label className="text-xs text-text-muted">Panel hizmet numarası (boş = otomatik)</label><input className={inputCls} inputMode="numeric" value={f.service_id} onChange={(e) => set({ service_id: e.target.value.replace(/\D/g, '') })} /></div>}
              <div><label className="text-xs text-text-muted">Kategori</label>
                <select className={inputCls} value={f.category} onChange={(e) => set({ category: e.target.value })}>{[...new Set([f.category, ...cats])].map((c) => <option key={c}>{c}</option>)}</select></div>
              <div><label className="text-xs text-text-muted">veya yeni kategori</label><input className={inputCls} placeholder="Yeni kategori adı" value={f.newCategory} onChange={(e) => set({ newCategory: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className="text-xs text-text-muted">Açıklama</label><textarea rows={2} className={inputCls} value={f.description} onChange={(e) => set({ description: e.target.value })} /></div>
            </div>

            <div className="p-3 rounded-xl bg-bg-elevated space-y-3">
              <div className="text-sm font-medium text-text-primary">Kaynak</div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div><label className="text-xs text-text-muted">API sağlayıcısı</label>
                  <select className={inputCls} value={f.provider_id} onChange={(e) => { set({ provider_id: e.target.value }); setVerify({ state: 'idle' }); }}>
                    <option value="">Manuel hizmet (sağlayıcı yok)</option>
                    {providers.map((p) => <option key={p.id} value={p.id}>{p.name}{p.enabled ? '' : ' (pasif)'}</option>)}
                  </select></div>
                {f.provider_id && <>
                  <div><label className="text-xs text-text-muted">Sağlayıcı servis ID</label>
                    <input className={inputCls} value={f.original_id} onChange={(e) => { set({ original_id: e.target.value }); setVerify({ state: 'idle' }); }} /></div>
                  <div className="flex items-end"><button type="button" onClick={doVerify} disabled={verify.state === 'busy'} className={`${btnGhost} w-full`}>
                    {verify.state === 'busy' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Doğrula</button></div>
                </>}
              </div>
              {f.id && f.provider_id && (f.provider_id !== f.orig_provider_id || f.original_id !== f.orig_original_id) && (
                <div className="text-xs text-warning-400">Eşleme değişiyor: sağlayıcı servis <b>{f.orig_original_id || '-'}</b> → <b>{f.original_id || '-'}</b>. Panel hizmet numarası <b>#{f.service_id}</b> aynı kalır; yeni siparişler yeni servise gider, eski siparişler eski kayıtlarıyla korunur.</div>
              )}
              {verify.state === 'bad' && <div className="text-xs text-error-400 break-words">❌ {verify.text}</div>}
              {verify.state === 'ok' && verify.svc && (
                <div className="text-xs space-y-1 p-2 rounded-lg bg-success-500/10 text-success-400">
                  <div>✅ <b>#{verify.svc.id}</b> {verify.svc.name}</div>
                  <div>Kategori: {verify.svc.category} · Maliyet: ${verify.svc.rate}/1K · Min {verify.svc.min} · Max {verify.svc.max} · Tür: {verify.svc.type} · Refill: {verify.svc.refill ? 'var' : 'yok'} · İptal: {verify.svc.cancel ? 'var' : 'yok'}</div>
                  <button type="button" onClick={fillFromVerified} className="inline-flex items-center gap-1 underline"><Wand2 className="w-3 h-3" /> Bu bilgileri forma doldur</button>
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-4 gap-3">
              <div><label className="text-xs text-text-muted">Rate ($/1000){f.provider_rate ? ` · maliyet $${f.provider_rate}` : ''}</label><input className={inputCls} inputMode="decimal" value={f.rate} onChange={(e) => set({ rate: e.target.value })} /></div>
              <div><label className="text-xs text-text-muted">Min sipariş</label><input className={inputCls} inputMode="numeric" value={f.min_order} onChange={(e) => set({ min_order: e.target.value })} /></div>
              <div><label className="text-xs text-text-muted">Max sipariş</label><input className={inputCls} inputMode="numeric" value={f.max_order} onChange={(e) => set({ max_order: e.target.value })} /></div>
              <div><label className="text-xs text-text-muted">Durum</label><select className={inputCls} value={f.is_active ? '1' : '0'} onChange={(e) => set({ is_active: e.target.value === '1' })}><option value="1">Aktif</option><option value="0">Pasif</option></select></div>
            </div>

            <div className="p-3 rounded-xl bg-bg-elevated space-y-3">
              <label className="flex items-center gap-2 text-sm text-text-primary">
                <input type="checkbox" checked={f.custom} onChange={(e) => set({ custom: e.target.checked, service_type: e.target.checked ? 'Custom Comments' : 'Default' })} />
                Custom Hizmet <span className="text-xs text-text-muted">(müşteri özel metin/yorum girer)</span>
              </label>
              <div className="grid sm:grid-cols-3 gap-3">
                <div><label className="text-xs text-text-muted">Hizmet türü</label>
                  <select className={inputCls} value={f.service_type} onChange={(e) => set({ service_type: e.target.value, custom: e.target.value !== 'Default' })}>
                    {SERVICE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
                  {CUSTOM_TYPES.includes(f.service_type) && <div className="text-[11px] text-text-muted mt-1">Müşteri her satıra bir yorum yazar; adet satır sayısıdır.</div>}</div>
                <label className="flex items-center gap-2 text-sm text-text-secondary sm:mt-5"><input type="checkbox" checked={f.refill_enabled} onChange={(e) => set({ refill_enabled: e.target.checked })} /> Refill destekli</label>
                <label className="flex items-center gap-2 text-sm text-text-secondary sm:mt-5"><input type="checkbox" checked={f.cancel_enabled} onChange={(e) => set({ cancel_enabled: e.target.checked })} /> İptal destekli</label>
              </div>
              {f.refill_enabled && (
                <div className="max-w-xs"><label className="text-xs text-text-muted">Refill garanti süresi (gün, 0 = lifetime)</label>
                  <input className={inputCls} inputMode="numeric" value={f.refill_days} onChange={(e) => set({ refill_days: e.target.value.replace(/\D/g, '') })} />
                  <div className="text-[11px] text-text-muted mt-1">Süre değişikliği yalnızca bundan sonraki siparişlere uygulanır; eski siparişlerin hakkı değişmez.</div></div>
              )}
            </div>

            {f.provider_id && (
              <div className="p-3 rounded-xl bg-bg-elevated space-y-3">
                <div className="text-sm font-medium text-text-primary">Otomatik fiyatlandırma</div>
                <div className="grid sm:grid-cols-5 gap-3">
                  <div className="sm:col-span-2"><label className="text-xs text-text-muted">Yöntem</label>
                    <select className={inputCls} value={f.pricing_mode} onChange={(e) => set({ pricing_mode: e.target.value })}>
                      <option value="manual">Manuel (fiyatı ben belirlerim)</option><option value="ratio">Maliyet × çarpan</option>
                      <option value="percent">Maliyete % ekle</option><option value="fixed_profit">Sabit kâr ekle ($)</option></select></div>
                  <div><label className="text-xs text-text-muted">Değer</label><input className={inputCls} disabled={f.pricing_mode === 'manual'} value={f.pricing_value} onChange={(e) => set({ pricing_value: e.target.value })} /></div>
                  <div><label className="text-xs text-text-muted">Min kâr ($)</label><input className={inputCls} value={f.min_profit} onChange={(e) => set({ min_profit: e.target.value })} /></div>
                  <div><label className="text-xs text-text-muted">Min fiyat ($)</label><input className={inputCls} value={f.min_price} onChange={(e) => set({ min_price: e.target.value })} /></div>
                </div>
                <div className="max-w-[200px]"><label className="text-xs text-text-muted">Yukarı yuvarlama adımı (örn. 0.05)</label><input className={inputCls} value={f.round_to} onChange={(e) => set({ round_to: e.target.value })} /></div>
                <div className="text-[11px] text-text-muted">Satış fiyatı hiçbir zaman sağlayıcı maliyetinin altına düşmez. Zamanlayıcı yalnızca "Manuel" olmayan hizmetlerin fiyatını günceller (maliyet satışı aşarsa manuel olanlar da korunur).</div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setForm(null)} className={btnGhost}>Vazgeç</button>
              <button onClick={save} disabled={saving} className={btnPrimary}>{saving && <Loader2 className="w-4 h-4 animate-spin" />} Kaydet</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

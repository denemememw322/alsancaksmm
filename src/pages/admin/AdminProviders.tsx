import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, X, RefreshCw, Plug, Globe, Search, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { providerApi, type ProviderService } from '@/lib/providerApi';

type Provider = { id: string; name: string; url: string; enabled: boolean };
type PService = ProviderService;
type Msg = { ok: boolean; text: string } | null;

const empty = { id: null as string | null, name: '', url: '', api_key: '', enabled: true };
const input = 'w-full px-3 py-2 rounded-lg bg-bg-elevated border border-border-default text-sm text-text-primary focus:outline-none focus:border-brand-500';
const SHOW_LIMIT = 200;
const CHUNK = 500;
const callApi = providerApi;

export default function AdminProviders() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [editing, setEditing] = useState<typeof empty | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [info, setInfo] = useState<Record<string, string>>({});
  const [markup, setMarkup] = useState(2);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [services, setServices] = useState<PService[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<string | null>(null);
  const [targetCat, setTargetCat] = useState('');
  const [panelCats, setPanelCats] = useState<string[]>([]);
  const [validateId, setValidateId] = useState('');
  const [validateResult, setValidateResult] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from('api_providers').select('id,name,url,enabled').order('name');
    if (error) setMsg({ ok: false, text: `Sağlayıcılar yüklenemedi: ${error.message}` });
    setProviders((data as Provider[]) || []);
  };

  useEffect(() => {
    load();
    supabase.from('categories').select('name').order('sort_order').order('name').then(({ data }) => setPanelCats((data || []).map((c: any) => c.name)));
    supabase.from('settings').select('default_markup').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data?.default_markup) setMarkup(Number(data.default_markup));
    });
  }, []);

  const setB = (id: string, v: string | null) =>
    setBusy((b) => { const n = { ...b }; if (v) n[id] = v; else delete n[id]; return n; });

  const save = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    const url = editing.url.trim();
    if (!name) return setMsg({ ok: false, text: 'Sağlayıcı adı gerekli.' });
    if (!/^https:\/\/[^\s/]+/.test(url)) return setMsg({ ok: false, text: 'API URL https:// ile başlamalı (örn. https://site.com/api/v2).' });
    if (!editing.id && !editing.api_key.trim()) return setMsg({ ok: false, text: 'API anahtarı gerekli.' });
    setSaving(true);
    setMsg(null);
    const payload: Record<string, unknown> = { name, url, enabled: editing.enabled, updated_at: new Date().toISOString() };
    if (editing.api_key.trim()) payload.api_key = editing.api_key.trim();
    const { error } = editing.id
      ? await supabase.from('api_providers').update(payload).eq('id', editing.id)
      : await supabase.from('api_providers').insert(payload);
    setSaving(false);
    if (error) return setMsg({ ok: false, text: `Kaydedilemedi: ${error.message}` });
    setEditing(null);
    setMsg({ ok: true, text: 'Sağlayıcı kaydedildi. Şimdi "Bağlantıyı Test Et" ile doğrulayabilirsin.' });
    load();
  };

  const remove = async (p: Provider) => {
    const { count } = await supabase.from('services').select('id', { count: 'exact', head: true }).eq('provider_id', p.id);
    const note = count ? `\n\n${count} hizmet bu sağlayıcıya bağlı. Silinirse hizmetler kalır ama sağlayıcı bağlantısı kopar (siparişler API'ye gitmez).` : '';
    if (!window.confirm(`"${p.name}" silinsin mi?${note}`)) return;
    const { error } = await supabase.from('api_providers').delete().eq('id', p.id);
    if (error) return setMsg({ ok: false, text: `Silinemedi: ${error.message}` });
    if (activeId === p.id) { setActiveId(null); setServices([]); }
    load();
  };

  const toggle = async (p: Provider) => {
    const { error } = await supabase.from('api_providers').update({ enabled: !p.enabled }).eq('id', p.id);
    if (error) return setMsg({ ok: false, text: error.message });
    load();
  };

  const test = async (p: Provider) => {
    setB(p.id, 'test');
    setMsg(null);
    try {
      const r = await callApi({ action: 'test', provider_id: p.id });
      setInfo((i) => ({ ...i, [p.id]: `Bağlantı başarılı · Bakiye: ${r.balance ?? '?'} ${r.currency ?? ''} · ${r.latency_ms} ms` }));
    } catch (e: any) {
      setInfo((i) => ({ ...i, [p.id]: '' }));
      setMsg({ ok: false, text: `${p.name}: ${e.message}` });
    }
    setB(p.id, null);
  };

  const fetchServices = async (p: Provider) => {
    setB(p.id, 'fetch');
    setMsg(null);
    setActiveId(p.id);
    setServices([]);
    setSelected(new Set());
    setSearch('');
    setCategory('');
    setValidateResult(null);
    try {
      const r = await callApi({ action: 'services', provider_id: p.id });
      setServices(r.services as PService[]);
      setMsg({ ok: true, text: `${p.name}: ${r.count} hizmet çekildi. İçe aktarmak istediklerini seç.` });
    } catch (e: any) {
      setActiveId(null);
      setMsg({ ok: false, text: `${p.name}: ${e.message}` });
    }
    setB(p.id, null);
  };

  const categories = useMemo(() => Array.from(new Set(services.map((s) => s.category))).sort(), [services]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => (!category || s.category === category) && (!q || s.id === q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)));
  }, [services, search, category]);

  const toggleOne = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selectFiltered = () => setSelected((prev) => { const n = new Set(prev); filtered.forEach((s) => n.add(s.id)); return n; });
  const clearSel = () => setSelected(new Set());

  const importSelected = async () => {
    const provider = providers.find((p) => p.id === activeId);
    if (!provider) return;
    const items = services.filter((s) => selected.has(s.id)).map((s) => ({
      id: s.id, name: s.name, category: s.category, rate: s.rate, min_order: s.min || 1, max_order: s.max || 100000, type: s.type, refill: s.refill, cancel: s.cancel,
    }));
    if (items.length === 0) return setMsg({ ok: false, text: 'En az 1 hizmet seç.' });
    if (!window.confirm(`${items.length} hizmet "${provider.name}" sağlayıcısından içe aktarılsın mı?\nKategori: ${targetCat.trim() || 'platforma göre otomatik'}. Satış fiyatı = maliyet × ${markup}. Mevcut hizmetlerde fiyat, kategori ve aktiflik durumun korunur.`)) return;
    setMsg(null);
    let inserted = 0, updated = 0, skipped = 0;
    try {
      for (let i = 0; i < items.length; i += CHUNK) {
        setProgress(`${Math.min(i + CHUNK, items.length)} / ${items.length} aktarılıyor...`);
        const { data, error } = await supabase.rpc('admin_import_services', { p_provider: provider.id, p_items: items.slice(i, i + CHUNK), p_category: targetCat.trim() || null });
        if (error) throw new Error(error.message);
        if (data?.success === false) throw new Error(data.error);
        inserted += data.inserted; updated += data.updated; skipped += data.skipped;
      }
      setMsg({ ok: true, text: `Tamamlandı: ${inserted} yeni eklendi, ${updated} güncellendi, ${skipped} atlandı, 0 başarısız. Yeni hizmetler aktif ve platform kategorisine yerleştirildi; Hizmetler sayfasından düzenleyebilirsin.` });
      clearSel();
    } catch (e: any) {
      setMsg({ ok: false, text: `İçe aktarma durdu (${inserted + updated} kayıt yazıldı): ${e.message}` });
    }
    setProgress(null);
  };

  const validate = async () => {
    if (!activeId || !validateId.trim()) return;
    setValidateResult('Kontrol ediliyor...');
    try {
      const r = await callApi({ action: 'validate', provider_id: activeId, service_id: validateId.trim() });
      setValidateResult(r.found
        ? `✅ #${r.service.id} · ${r.service.name} · ${r.service.category} · maliyet ${r.service.rate}/1K · min ${r.service.min} max ${r.service.max} · refill ${r.service.refill ? 'var' : 'yok'} · iptal ${r.service.cancel ? 'var' : 'yok'}`
        : `❌ ${r.message}`);
    } catch (e: any) { setValidateResult(`❌ ${e.message}`); }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-text-primary">🔌 API Sağlayıcılar</h2>
        <button onClick={() => { setEditing({ ...empty }); setMsg(null); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm">
          <Plus className="w-4 h-4" /> Yeni Sağlayıcı
        </button>
      </div>

      {msg && (
        <div className={`p-3 rounded-xl border text-sm flex gap-2 ${msg.ok ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          {msg.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span className="break-words">{msg.text}</span>
        </div>
      )}

      {editing && (
        <div className="p-4 rounded-2xl bg-bg-surface border border-border-subtle space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-text-primary">{editing.id ? 'Sağlayıcıyı Düzenle' : 'Yeni Sağlayıcı'}</h3>
            <button onClick={() => setEditing(null)} className="p-1 text-text-muted"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <div><label className="text-xs text-text-muted">Ad</label><input className={input} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><label className="text-xs text-text-muted">API URL</label><input className={input} placeholder="https://site.com/api/v2" value={editing.url} onChange={(e) => setEditing({ ...editing, url: e.target.value })} /></div>
            <div><label className="text-xs text-text-muted">API Anahtarı {editing.id && '(boş bırakırsan değişmez)'}</label>
              <input className={input} type="password" autoComplete="off" value={editing.api_key} onChange={(e) => setEditing({ ...editing, api_key: e.target.value })} /></div>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={editing.enabled} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} /> Aktif</label>
            <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm disabled:opacity-50 flex items-center gap-1.5">
              {saving && <RefreshCw className="w-4 h-4 animate-spin" />} Kaydet
            </button>
          </div>
        </div>
      )}

      {providers.length === 0 && !editing && <p className="text-sm text-text-muted">Henüz sağlayıcı yok.</p>}

      {providers.map((p) => (
        <div key={p.id} className="p-4 rounded-2xl bg-bg-surface border border-border-subtle">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-text-primary">{p.name}</span>
                <button onClick={() => toggle(p)} className={`text-xs px-2 py-0.5 rounded-full ${p.enabled ? 'bg-success-500/10 text-success-400' : 'bg-error-500/10 text-error-400'}`}>{p.enabled ? 'Aktif' : 'Pasif'}</button>
              </div>
              <p className="text-xs text-text-muted truncate mt-0.5">{p.url}</p>
              {info[p.id] && <p className="text-xs text-success-400 mt-1">{info[p.id]}</p>}
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button onClick={() => { setEditing({ id: p.id, name: p.name, url: p.url, api_key: '', enabled: p.enabled }); setMsg(null); }} className="p-2 rounded-lg bg-bg-elevated text-text-secondary"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => remove(p)} className="p-2 rounded-lg bg-error-500/10 text-error-400"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={() => test(p)} disabled={!!busy[p.id]} className="px-3 py-1.5 rounded-lg bg-bg-elevated text-text-primary text-xs font-medium disabled:opacity-50 flex items-center gap-1.5">
              {busy[p.id] === 'test' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />} Bağlantıyı Test Et
            </button>
            <button onClick={() => fetchServices(p)} disabled={!!busy[p.id]} className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5">
              {busy[p.id] === 'fetch' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />} Hizmetleri Çek
            </button>
          </div>

          {activeId === p.id && services.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border-subtle space-y-3">
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input className={`${input} pl-9`} placeholder="Hizmet ID veya ad ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <select className={`${input} max-w-xs`} value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Tüm kategoriler ({categories.length})</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-text-secondary">{filtered.length} sonuç · <b className="text-brand-400">{selected.size}</b> seçili</span>
                <button onClick={selectFiltered} className="text-xs text-brand-400">Filtredekilerin hepsini seç ({filtered.length})</button>
                <button onClick={clearSel} className="text-xs text-text-muted">Seçimi temizle</button>
                <input list="panel-cats" value={targetCat} onChange={(e) => setTargetCat(e.target.value)} placeholder="Hedef kategori (boş = otomatik platform)" className={`${input} max-w-[260px] text-xs`} />
                <datalist id="panel-cats">{panelCats.map((c) => <option key={c} value={c} />)}</datalist>
                <button onClick={importSelected} disabled={!selected.size || !!progress} className="ml-auto px-3 py-1.5 rounded-lg bg-success-600 text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> {progress ?? `Seçilenleri İçe Aktar (${selected.size})`}
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-1">
                {filtered.slice(0, SHOW_LIMIT).map((s) => (
                  <div key={s.id} onClick={() => toggleOne(s.id)}
                    className={`flex items-center justify-between gap-3 py-2 px-3 rounded-lg border cursor-pointer text-sm ${selected.has(s.id) ? 'bg-brand-500/10 border-brand-500/30' : 'border-border-subtle hover:border-border-default'}`}>
                    <div className="min-w-0">
                      <div className="text-text-primary truncate"><span className="text-text-muted">#{s.id}</span> {s.name}</div>
                      <div className="text-xs text-text-muted truncate">{s.category} · {s.min}-{s.max}{s.type !== 'Default' ? ` · ${s.type}` : ''}{s.refill ? ' · refill' : ''}{s.cancel ? ' · iptal' : ''}</div>
                    </div>
                    <div className="text-right shrink-0 text-xs">
                      <div className="text-text-secondary">maliyet ${s.rate}</div>
                      <div className="text-brand-400">satış ${(s.rate * markup).toFixed(4)}</div>
                    </div>
                  </div>
                ))}
                {filtered.length > SHOW_LIMIT && <p className="text-xs text-text-muted text-center py-2">İlk {SHOW_LIMIT} sonuç gösteriliyor. Aramayı daralt ya da "Filtredekilerin hepsini seç" kullan.</p>}
                {filtered.length === 0 && <p className="text-sm text-text-muted text-center py-4">Sonuç yok.</p>}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border-subtle">
                <input className={`${input} max-w-[200px]`} placeholder="Hizmet ID doğrula" value={validateId} onChange={(e) => setValidateId(e.target.value)} />
                <button onClick={validate} className="px-3 py-2 rounded-lg bg-bg-elevated text-text-primary text-xs">Doğrula</button>
                {validateResult && <span className="text-xs text-text-secondary break-words">{validateResult}</span>}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

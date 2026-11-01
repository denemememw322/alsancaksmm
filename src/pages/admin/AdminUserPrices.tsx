import { useCallback, useEffect, useState } from 'react';
import { Search, Trash2, Save, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Badge, NoticeBar, btnDanger, btnGhost, btnPrimary, fmtDate, inputCls, type Notice } from '@/components/ui';

type U = { user_id: string; label: string };
type S = { id: string; service_id: number; name: string; rate_per_1000: number; provider_rate: number | null };
type Row = { id: string; user_id: string; service_id: string; price: number; ratio: number | null; auto_pricing: boolean; updated_at: string };

export default function AdminUserPrices() {
  const [mode, setMode] = useState<'user' | 'service'>('user');
  const [user, setUser] = useState<U | null>(null);
  const [service, setService] = useState<S | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [svcs, setSvcs] = useState<Record<string, S>>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [price, setPrice] = useState('');
  const [auto, setAuto] = useState(true);
  const [uq, setUq] = useState(''); const [uRes, setURes] = useState<U[]>([]);
  const [sq, setSq] = useState(''); const [sRes, setSRes] = useState<S[]>([]);
  const [hist, setHist] = useState<any[]>([]);
  const [edit, setEdit] = useState<{ id: string; v: string } | null>(null);

  useEffect(() => {
    const t = uq.trim().replace(/[%,()]/g, ' '); if (t.length < 2) { setURes([]); return; }
    const h = setTimeout(async () => { const { data } = await supabase.from('profiles').select('user_id,email,username').or(`email.ilike.%${t}%,username.ilike.%${t}%`).limit(8); setURes((data || []).map((p: any) => ({ user_id: p.user_id, label: p.email || p.username }))); }, 250);
    return () => clearTimeout(h);
  }, [uq]);
  useEffect(() => {
    const t = sq.trim().replace(/[%,()]/g, ' '); if (!t) { setSRes([]); return; }
    const h = setTimeout(async () => {
      let q = supabase.from('services').select('id,service_id,name,rate_per_1000,provider_rate').limit(8);
      q = /^\d+$/.test(t) ? q.eq('service_id', Number(t)) : q.ilike('name', `%${t}%`);
      const { data } = await q; setSRes((data as S[]) || []);
    }, 250);
    return () => clearTimeout(h);
  }, [sq]);

  const load = useCallback(async () => {
    if ((mode === 'user' && !user) || (mode === 'service' && !service)) { setRows([]); return; }
    let q = supabase.from('user_service_prices').select('*').order('updated_at', { ascending: false });
    q = mode === 'user' ? q.eq('user_id', user!.user_id) : q.eq('service_id', service!.id);
    const { data, error } = await q;
    if (error) return setNotice({ ok: false, text: error.message });
    const list = (data as Row[]) || []; setRows(list);
    const uids = [...new Set(list.map((r) => r.user_id))], sids = [...new Set(list.map((r) => r.service_id))];
    if (uids.length) { const { data: ps } = await supabase.from('profiles').select('user_id,email,username').in('user_id', uids); setUsers(Object.fromEntries((ps || []).map((p: any) => [p.user_id, p.email || p.username]))); }
    if (sids.length) { const { data: ss } = await supabase.from('services').select('id,service_id,name,rate_per_1000,provider_rate').in('id', sids); setSvcs(Object.fromEntries((ss || []).map((x: any) => [x.id, x]))); }
    let h = supabase.from('price_history').select('*').not('user_id', 'is', null).order('created_at', { ascending: false }).limit(15);
    h = mode === 'user' ? h.eq('user_id', user!.user_id) : h.eq('service_id', service!.id);
    const { data: hh } = await h; setHist(hh || []);
  }, [mode, user, service]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!user || !service) return setNotice({ ok: false, text: 'Önce kullanıcı ve hizmet seç.' });
    const p = Number(price);
    if (!(p > 0)) return setNotice({ ok: false, text: 'Geçerli bir özel fiyat gir.' });
    if (service.provider_rate && p < service.provider_rate) return setNotice({ ok: false, text: `Özel fiyat sağlayıcı maliyetinin ($${service.provider_rate}) altında olamaz.` });
    const { error } = await supabase.from('user_service_prices').upsert({ user_id: user.user_id, service_id: service.id, price: p, auto_pricing: auto }, { onConflict: 'user_id,service_id' });
    if (error) return setNotice({ ok: false, text: error.message });
    setNotice({ ok: true, text: `Özel fiyat kaydedildi: ${user.label} · #${service.service_id} · $${p}. Genel fiyat ($${service.rate_per_1000}) değişmedi.` }); setPrice(''); load();
  };
  const saveEdit = async (r: Row) => {
    const p = Number(edit?.v); if (!(p > 0)) return setNotice({ ok: false, text: 'Geçerli bir fiyat gir.' });
    const { error } = await supabase.from('user_service_prices').update({ price: p }).eq('id', r.id);
    if (error) return setNotice({ ok: false, text: error.message }); setEdit(null); load();
  };
  const toggleAuto = async (r: Row) => { await supabase.from('user_service_prices').update({ auto_pricing: !r.auto_pricing }).eq('id', r.id); load(); };
  const del = async (r: Row) => { if (!window.confirm('Bu özel fiyat kaldırılsın mı? Kullanıcı genel fiyata döner.')) return; const { error } = await supabase.from('user_service_prices').delete().eq('id', r.id); setNotice(error ? { ok: false, text: error.message } : { ok: true, text: 'Özel fiyat kaldırıldı.' }); load(); };

  const cost = service?.provider_rate && service.provider_rate > 0 ? service.provider_rate : null;
  const pn = Number(price);

  return (
    <div className="space-y-5 max-w-6xl">
      <h2 className="text-2xl font-bold text-text-primary">Kullanıcıya Özel Fiyatlar</h2>
      <p className="text-sm text-text-secondary">Genel fiyatı değiştirmeden belirli kullanıcılara belirli hizmetlerde özel fiyat tanımla. Her özel fiyatın kendi referans oranı vardır; sağlayıcı maliyeti değişince kendi oranıyla güncellenir ve asla maliyetin altına düşmez.</p>
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />

      <div className="p-4 rounded-2xl bg-bg-surface border border-border-subtle space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="relative"><label className="text-xs text-text-muted">1) Kullanıcı</label>
            {user ? <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-bg-elevated text-sm text-text-primary"><span className="truncate">{user.label}</span><button onClick={() => setUser(null)}><X className="w-4 h-4" /></button></div>
              : <><input className={inputCls} placeholder="E-posta veya kullanıcı adı ara" value={uq} onChange={(e) => setUq(e.target.value)} />
                {uRes.length > 0 && <div className="absolute z-10 left-0 right-0 mt-1 rounded-xl bg-bg-surface border border-border-default shadow-xl max-h-52 overflow-y-auto">{uRes.map((u) => <button key={u.user_id} onClick={() => { setUser(u); setUq(''); setURes([]); }} className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-bg-hover truncate">{u.label}</button>)}</div>}</>}</div>
          <div className="relative"><label className="text-xs text-text-muted">2) Hizmet</label>
            {service ? <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-bg-elevated text-sm text-text-primary"><span className="truncate">#{service.service_id} {service.name}</span><button onClick={() => setService(null)}><X className="w-4 h-4" /></button></div>
              : <><div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input className={`${inputCls} pl-9`} placeholder="Hizmet ID veya ad ara" value={sq} onChange={(e) => setSq(e.target.value)} /></div>
                {sRes.length > 0 && <div className="absolute z-10 left-0 right-0 mt-1 rounded-xl bg-bg-surface border border-border-default shadow-xl max-h-52 overflow-y-auto">{sRes.map((x) => <button key={x.id} onClick={() => { setService(x); setSq(''); setSRes([]); }} className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-bg-hover"><span className="text-text-muted">#{x.service_id}</span> {x.name}</button>)}</div>}</>}</div>
        </div>
        {service && (
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div className="space-y-2">
              <label className="text-xs text-text-muted">3) Bu kullanıcıya özel satış fiyatı ($ / 1000) · genel fiyat: ${Number(service.rate_per_1000).toFixed(4)}{cost ? ` · maliyet: $${cost.toFixed(4)}` : ' · maliyet bilinmiyor'}</label>
              <input className={inputCls} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="örn. 0.80" />
              {cost && pn > 0 && <div className="text-xs text-text-secondary">{pn < cost ? <span className="text-error-400">Maliyetin altında olamaz.</span> : <>Eklenen oran %{(((pn - cost) / cost) * 100).toFixed(2)} · brüt kâr/1000 ${(pn - cost).toFixed(4)} · marj %{(((pn - cost) / pn) * 100).toFixed(2)} · referans {(pn / cost).toFixed(4)}×</>}</div>}
              {!cost && pn > 0 && <div className="text-xs text-warning-400">Maliyet bilinmediği için oran hesaplanamadı (manuel hizmet veya maliyet eksik).</div>}
              <label className="flex items-center gap-2 text-xs text-text-secondary"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Otomatik oran koruma (maliyet değişince bu fiyat kendi oranıyla güncellenir)</label>
            </div>
            <button className={btnPrimary} onClick={save}><Save className="w-4 h-4" /> Kaydet</button>
          </div>)}
      </div>

      <div className="flex gap-2">
        <button onClick={() => setMode('user')} className={`px-3 py-1.5 rounded-lg text-sm ${mode === 'user' ? 'bg-brand-600 text-white' : 'bg-bg-elevated text-text-secondary'}`}>Kullanıcının tüm özel fiyatları</button>
        <button onClick={() => setMode('service')} className={`px-3 py-1.5 rounded-lg text-sm ${mode === 'service' ? 'bg-brand-600 text-white' : 'bg-bg-elevated text-text-secondary'}`}>Hizmetin özel fiyatlı kullanıcıları</button>
      </div>
      {((mode === 'user' && !user) || (mode === 'service' && !service)) && <div className="text-sm text-text-muted">{mode === 'user' ? 'Listeyi görmek için yukarıdan bir kullanıcı seç.' : 'Listeyi görmek için yukarıdan bir hizmet seç.'}</div>}

      <div className="rounded-2xl bg-bg-surface border border-border-subtle overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="border-b border-border-subtle"><tr className="text-text-muted text-xs uppercase"><th className="px-3 py-3 text-left">{mode === 'user' ? 'Hizmet' : 'Kullanıcı'}</th><th className="px-3 py-3 text-right">Genel fiyat</th><th className="px-3 py-3 text-right">Özel fiyat</th><th className="px-3 py-3 text-right">Maliyet</th><th className="px-3 py-3 text-right">Oran</th><th className="px-3 py-3 text-left">Oto</th><th className="px-3 py-3"></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">Kayıt yok</td></tr>}
            {rows.map((r) => { const sv = svcs[r.service_id]; const c = sv?.provider_rate && sv.provider_rate > 0 ? sv.provider_rate : null; return (
              <tr key={r.id} className="border-b border-border-subtle last:border-0">
                <td className="px-3 py-3 text-text-primary max-w-[280px] break-words">{mode === 'user' ? `#${sv?.service_id ?? '?'} ${sv?.name ?? ''}` : users[r.user_id] || r.user_id}</td>
                <td className="px-3 py-3 text-right text-text-secondary">${Number(sv?.rate_per_1000 ?? 0).toFixed(4)}</td>
                <td className="px-3 py-3 text-right">{edit?.id === r.id ? <input autoFocus className="w-24 px-2 py-1 rounded bg-bg-elevated border border-border-default text-right text-text-primary" value={edit.v} onChange={(e) => setEdit({ id: r.id, v: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && saveEdit(r)} /> : <button className="font-semibold text-brand-400" onClick={() => setEdit({ id: r.id, v: String(r.price) })}>${Number(r.price).toFixed(4)}</button>}</td>
                <td className="px-3 py-3 text-right text-text-muted">{c ? `$${c.toFixed(4)}` : '-'}</td>
                <td className="px-3 py-3 text-right text-text-muted">{r.ratio ? `${Number(r.ratio).toFixed(3)}×` : c ? '-' : <span title="Maliyet bilinmiyor">?</span>}</td>
                <td className="px-3 py-3"><button onClick={() => toggleAuto(r)}><Badge tone={r.auto_pricing ? 'ok' : 'muted'}>{r.auto_pricing ? 'Açık' : 'Kapalı'}</Badge></button></td>
                <td className="px-3 py-3"><div className="flex gap-1.5 justify-end">{edit?.id === r.id && <><button className={btnPrimary} onClick={() => saveEdit(r)}>Kaydet</button><button className={btnGhost} onClick={() => setEdit(null)}>Vazgeç</button></>}<button className={btnDanger} onClick={() => del(r)}><Trash2 className="w-4 h-4" /></button></div></td>
              </tr>); })}
          </tbody>
        </table>
      </div>

      {hist.length > 0 && (<div className="p-4 rounded-2xl bg-bg-surface border border-border-subtle"><div className="text-sm font-medium text-text-primary mb-2">Özel fiyat değişiklik geçmişi</div>
        <div className="space-y-1 max-h-56 overflow-y-auto">{hist.map((h) => <div key={h.id} className="text-xs text-text-secondary flex flex-wrap gap-x-3"><span>{fmtDate(h.created_at)}</span><span>#{h.panel_service_id}</span><span>{users[h.user_id] || ''}</span><span>${h.old_price ?? '-'} → ${h.new_price}</span><span>maliyet {h.old_cost ?? '-'} → {h.new_cost ?? '-'}</span><Badge tone={h.source === 'manual' ? 'brand' : 'muted'}>{h.source === 'manual' ? 'manuel' : 'otomatik'}</Badge><span className="text-text-muted">{h.reason}</span></div>)}</div></div>)}
    </div>
  );
}

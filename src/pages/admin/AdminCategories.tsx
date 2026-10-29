import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Badge, NoticeBar, btnGhost, btnPrimary, inputCls, type Notice } from '@/components/ui';

type Cat = { id: string; name: string; sort_order: number; is_active: boolean };

export default function AdminCategories() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [name, setName] = useState('');
  const [edit, setEdit] = useState<{ id: string; old: string; value: string } | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('categories').select('*').order('sort_order').order('name');
    if (error) setNotice({ ok: false, text: error.message });
    setCats((data as Cat[]) || []);
    const map: Record<string, number> = {};
    for (let from = 0; ; from += 1000) {
      const { data: rows } = await supabase.from('services').select('category').range(from, from + 999);
      (rows || []).forEach((r: any) => { map[r.category] = (map[r.category] || 0) + 1; });
      if (!rows || rows.length < 1000) break;
    }
    setCounts(map);
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    const { error } = await supabase.from('categories').insert({ name: n, sort_order: (cats.at(-1)?.sort_order ?? 0) + 1 });
    if (error) return setNotice({ ok: false, text: /duplicate|unique/i.test(error.message) ? 'Bu isimde kategori zaten var.' : error.message });
    setName(''); setNotice({ ok: true, text: `"${n}" oluşturuldu. Hizmet eklemeden de kullanılabilir.` }); load();
  };
  const rename = async () => {
    if (!edit) return;
    const { data, error } = await supabase.rpc('admin_rename_category', { p_old: edit.old, p_new: edit.value });
    if (error || data?.success === false) return setNotice({ ok: false, text: error?.message || data?.error });
    setEdit(null); setNotice({ ok: true, text: `Kategori yeniden adlandırıldı (${data.services_updated} hizmet güncellendi).` }); load();
  };
  const remove = async (c: Cat) => {
    const n = counts[c.name] || 0;
    const target = n > 0 ? window.prompt(`"${c.name}" içindeki ${n} hizmet hangi kategoriye taşınsın?`, 'Kategorisiz') : 'Kategorisiz';
    if (target === null) return;
    if (!window.confirm(`"${c.name}" silinsin mi?${n ? ` ${n} hizmet "${target}" kategorisine taşınır.` : ''}`)) return;
    const { data, error } = await supabase.rpc('admin_delete_category', { p_name: c.name, p_move_to: target });
    if (error || data?.success === false) return setNotice({ ok: false, text: error?.message || data?.error });
    setNotice({ ok: true, text: `"${c.name}" silindi (${data.services_moved} hizmet taşındı).` }); load();
  };
  const patch = async (c: Cat, p: Partial<Cat>) => {
    const { error } = await supabase.from('categories').update(p).eq('id', c.id);
    if (error) return setNotice({ ok: false, text: error.message });
    load();
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <h2 className="text-2xl font-bold text-text-primary">Kategoriler</h2>
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />
      <div className="flex gap-2">
        <input className={inputCls} placeholder="Yeni kategori adı" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button onClick={add} className={btnPrimary}><Plus className="w-4 h-4" /> Ekle</button>
      </div>
      <div className="rounded-2xl bg-bg-surface border border-border-subtle divide-y divide-border-subtle">
        {cats.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 p-3">
            <input type="number" className="w-16 px-2 py-1 rounded bg-bg-elevated border border-border-default text-sm text-text-primary" defaultValue={c.sort_order}
              onBlur={(e) => Number(e.target.value) !== c.sort_order && patch(c, { sort_order: Number(e.target.value) || 0 })} title="Sıra" />
            <div className="flex-1 min-w-[140px]">
              {edit?.id === c.id ? (
                <input autoFocus className={inputCls} value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && rename()} />
              ) : <span className="text-text-primary">{c.name}</span>}
            </div>
            <Badge tone={counts[c.name] ? 'brand' : 'muted'}>{counts[c.name] || 0} hizmet</Badge>
            <button onClick={() => patch(c, { is_active: !c.is_active })}><Badge tone={c.is_active ? 'ok' : 'bad'}>{c.is_active ? 'Görünür' : 'Gizli'}</Badge></button>
            {edit?.id === c.id ? (
              <div className="flex gap-1.5"><button onClick={rename} className={btnPrimary}><Check className="w-4 h-4" /></button><button onClick={() => setEdit(null)} className={btnGhost}><X className="w-4 h-4" /></button></div>
            ) : (
              <div className="flex gap-1.5">
                <button disabled={c.name === 'Kategorisiz'} onClick={() => setEdit({ id: c.id, old: c.name, value: c.name })} className="p-2 rounded-lg bg-bg-elevated text-text-secondary disabled:opacity-30"><Pencil className="w-4 h-4" /></button>
                <button disabled={c.name === 'Kategorisiz'} onClick={() => remove(c)} className="p-2 rounded-lg bg-error-500/10 text-error-400 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-text-muted">Boş kategoriler de yönetilebilir. "Gizli" kategori müşteri listesinde görünmez. Silinen kategorideki hizmetler seçtiğin kategoriye taşınır.</p>
    </div>
  );
}

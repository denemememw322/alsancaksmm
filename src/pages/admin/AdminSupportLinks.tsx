import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Badge, Modal, NoticeBar, btnGhost, btnPrimary, inputCls, type Notice } from '@/components/ui';

export const PLATFORMS: Record<string, { label: string; hint: string }> = {
  whatsapp: { label: 'WhatsApp', hint: 'Ülke koduyla numara, örn. 905551112233' },
  telegram: { label: 'Telegram', hint: 'Kullanıcı adı, örn. alsancak_destek' },
  discord: { label: 'Discord', hint: 'https://discord.gg/...' },
  instagram: { label: 'Instagram', hint: 'Kullanıcı adı' },
  email: { label: 'E-posta', hint: 'destek@site.com' },
  phone: { label: 'Telefon', hint: 'Ülke koduyla numara' },
  website: { label: 'Web sitesi', hint: 'https://...' },
  other: { label: 'Diğer', hint: 'https://...' },
};
export const previewUrl = (p: string, c: string) => {
  const t = c.trim(); if (!t) return '';
  if (p === 'whatsapp') return `https://wa.me/${t.replace(/\D/g, '')}`;
  if (p === 'phone') return `tel:+${t.replace(/\D/g, '')}`;
  if (p === 'telegram') return `https://t.me/${t.replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '').replace(/^@/, '')}`;
  if (p === 'instagram') return `https://instagram.com/${t.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[@/]/g, '')}`;
  if (p === 'email') return `mailto:${t}`;
  return t;
};

type L = { id: string | null; platform: string; display_name: string; contact: string; button_label: string; is_active: boolean; sort_order: number };
const blank: L = { id: null, platform: 'whatsapp', display_name: 'WhatsApp', contact: '', button_label: '', is_active: true, sort_order: 0 };

export default function AdminSupportLinks() {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState<L | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const load = useCallback(async () => { const { data, error } = await supabase.from('support_links').select('*').order('sort_order').order('created_at'); if (error) setNotice({ ok: false, text: error.message }); setRows(data || []); }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!f) return;
    const payload = { platform: f.platform, display_name: f.display_name.trim(), contact: f.contact.trim(), button_label: f.button_label.trim() || null, is_active: f.is_active, sort_order: Number(f.sort_order) || 0 };
    const { error } = f.id ? await supabase.from('support_links').update(payload).eq('id', f.id) : await supabase.from('support_links').insert(payload);
    if (error) return setNotice({ ok: false, text: error.message.replace(/^.*?: /, '') });
    setF(null); setNotice({ ok: true, text: 'Kaydedildi. Kullanıcılara yalnızca aktif ve dolu bağlantılar gösterilir.' }); load();
  };
  const del = async (r: any) => { if (!window.confirm(`"${r.display_name}" silinsin mi?`)) return; const { error } = await supabase.from('support_links').delete().eq('id', r.id); setNotice(error ? { ok: false, text: error.message } : null); load(); };
  const toggle = async (r: any) => { await supabase.from('support_links').update({ is_active: !r.is_active }).eq('id', r.id); load(); };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between"><h2 className="text-2xl font-bold text-text-primary">Canlı Destek Bağlantıları</h2><button className={btnPrimary} onClick={() => setF({ ...blank, sort_order: rows.length })}><Plus className="w-4 h-4" /> Ekle</button></div>
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />
      <div className="space-y-2">
        {rows.length === 0 && <div className="text-sm text-text-muted">Bağlantı yok. Eklediğin aktif bağlantılar sitede yüzen destek butonunda görünür.</div>}
        {rows.map((r) => (<div key={r.id} className="p-3 sm:p-4 rounded-2xl bg-bg-surface border border-border-subtle flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><span className="font-medium text-text-primary">{r.display_name}</span><Badge tone="brand">{PLATFORMS[r.platform]?.label}</Badge>
            <button onClick={() => toggle(r)}><Badge tone={r.is_active ? 'ok' : 'bad'}>{r.is_active ? 'Aktif' : 'Pasif'}</Badge></button></div>
            <a href={previewUrl(r.platform, r.contact)} target="_blank" rel="noopener noreferrer" className="text-xs text-text-muted hover:text-brand-400 break-all inline-flex items-center gap-1">{previewUrl(r.platform, r.contact)} <ExternalLink className="w-3 h-3" /></a></div>
          <div className="flex gap-1.5"><button className="p-2 rounded-lg bg-bg-elevated text-text-secondary" onClick={() => setF({ id: r.id, platform: r.platform, display_name: r.display_name, contact: r.contact, button_label: r.button_label || '', is_active: r.is_active, sort_order: r.sort_order })}><Pencil className="w-4 h-4" /></button>
            <button className="p-2 rounded-lg bg-error-500/10 text-error-400" onClick={() => del(r)}><Trash2 className="w-4 h-4" /></button></div></div>))}
      </div>
      <Modal open={!!f} onClose={() => setF(null)} title={f?.id ? 'Bağlantıyı düzenle' : 'Yeni destek bağlantısı'}>
        {f && <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="text-xs text-text-muted">Platform</label><select className={inputCls} value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value, display_name: f.display_name || PLATFORMS[e.target.value].label })}>
              {Object.entries(PLATFORMS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
            <div><label className="text-xs text-text-muted">Görünen ad</label><input className={inputCls} value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></div>
            <div className="sm:col-span-2"><label className="text-xs text-text-muted">İletişim bilgisi · {PLATFORMS[f.platform].hint}</label><input className={inputCls} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></div>
            <div><label className="text-xs text-text-muted">Buton etiketi (opsiyonel)</label><input className={inputCls} value={f.button_label} onChange={(e) => setF({ ...f, button_label: e.target.value })} /></div>
            <div><label className="text-xs text-text-muted">Sıra</label><input type="number" className={inputCls} value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: Number(e.target.value) })} /></div>
          </div>
          {f.contact.trim() && <div className="text-xs text-text-muted break-all">Kullanıcı tıkladığında açılacak adres: <span className="text-text-secondary">{previewUrl(f.platform, f.contact)}</span></div>}
          <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> Aktif</label>
          <div className="flex justify-end gap-2"><button className={btnGhost} onClick={() => setF(null)}>Vazgeç</button><button className={btnPrimary} onClick={save}>Kaydet</button></div>
        </div>}
      </Modal>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Badge, Modal, NoticeBar, btnGhost, btnPrimary, fmtDate, inputCls, type Notice } from '@/components/ui';

type A = { id: string | null; title: string; body: string; kind: string; is_active: boolean; starts_at: string; ends_at: string };
const blank: A = { id: null, title: '', body: '', kind: 'info', is_active: true, starts_at: '', ends_at: '' };
const toLocal = (s?: string | null) => (s ? new Date(new Date(s).getTime() - new Date(s).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
const tone: Record<string, 'brand' | 'ok' | 'warn' | 'bad'> = { info: 'brand', success: 'ok', warning: 'warn', danger: 'bad' };

export default function AdminAnnouncements() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState<A | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const load = useCallback(async () => { const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }); if (error) setNotice({ ok: false, text: error.message }); setRows(data || []); }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!f) return;
    if (!f.title.trim()) return setNotice({ ok: false, text: 'Başlık gerekli.' });
    if (f.starts_at && f.ends_at && new Date(f.ends_at) <= new Date(f.starts_at)) return setNotice({ ok: false, text: 'Bitiş tarihi başlangıçtan sonra olmalı.' });
    const payload: any = { title: f.title.trim(), body: f.body.trim(), kind: f.kind, is_active: f.is_active, starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : null, ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null };
    const { error } = f.id ? await supabase.from('announcements').update(payload).eq('id', f.id) : await supabase.from('announcements').insert({ ...payload, created_by: user?.id });
    if (error) return setNotice({ ok: false, text: error.message });
    setF(null); setNotice({ ok: true, text: 'Duyuru kaydedildi.' }); load();
  };
  const del = async (a: any) => { if (!window.confirm(`"${a.title}" silinsin mi?`)) return; const { error } = await supabase.from('announcements').delete().eq('id', a.id); setNotice(error ? { ok: false, text: error.message } : { ok: true, text: 'Silindi.' }); load(); };
  const live = (a: any) => a.is_active && (!a.starts_at || new Date(a.starts_at) <= new Date()) && (!a.ends_at || new Date(a.ends_at) >= new Date());

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between"><h2 className="text-2xl font-bold text-text-primary">Duyurular</h2><button className={btnPrimary} onClick={() => setF({ ...blank })}><Plus className="w-4 h-4" /> Yeni duyuru</button></div>
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />
      <div className="space-y-2">
        {rows.length === 0 && <div className="text-sm text-text-muted">Duyuru yok</div>}
        {rows.map((a) => (<div key={a.id} className="p-4 rounded-2xl bg-bg-surface border border-border-subtle flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-medium text-text-primary">{a.title}</span><Badge tone={tone[a.kind]}>{a.kind}</Badge>{live(a) ? <Badge tone="ok">Yayında</Badge> : <Badge>Yayında değil</Badge>}</div>
            <p className="text-sm text-text-secondary mt-1 break-words whitespace-pre-line">{a.body}</p><div className="text-xs text-text-muted mt-1">{a.starts_at ? `Başlangıç: ${fmtDate(a.starts_at)} ` : ''}{a.ends_at ? `Bitiş: ${fmtDate(a.ends_at)}` : ''}</div></div>
          <div className="flex gap-1.5"><button className="p-2 rounded-lg bg-bg-elevated text-text-secondary" onClick={() => setF({ id: a.id, title: a.title, body: a.body, kind: a.kind, is_active: a.is_active, starts_at: toLocal(a.starts_at), ends_at: toLocal(a.ends_at) })}><Pencil className="w-4 h-4" /></button>
            <button className="p-2 rounded-lg bg-error-500/10 text-error-400" onClick={() => del(a)}><Trash2 className="w-4 h-4" /></button></div></div>))}
      </div>
      <Modal open={!!f} onClose={() => setF(null)} title={f?.id ? 'Duyuruyu düzenle' : 'Yeni duyuru'}>
        {f && <div className="space-y-3">
          <input className={inputCls} placeholder="Başlık" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <textarea className={inputCls} rows={4} placeholder="Mesaj" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          <div className="grid sm:grid-cols-3 gap-3">
            <div><label className="text-xs text-text-muted">Tür</label><select className={inputCls} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="info">Bilgi</option><option value="success">Başarı</option><option value="warning">Uyarı</option><option value="danger">Önemli</option></select></div>
            <div><label className="text-xs text-text-muted">Başlangıç (opsiyonel)</label><input type="datetime-local" className={inputCls} value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} /></div>
            <div><label className="text-xs text-text-muted">Bitiş (opsiyonel)</label><input type="datetime-local" className={inputCls} value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> Aktif</label>
          <div className="flex justify-end gap-2"><button className={btnGhost} onClick={() => setF(null)}>Vazgeç</button><button className={btnPrimary} onClick={save}>Kaydet</button></div>
        </div>}
      </Modal>
    </div>
  );
}

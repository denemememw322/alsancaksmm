import { useEffect, useState } from 'react';
import { Info, CheckCircle2, AlertTriangle, XOctagon, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type A = { id: string; title: string; body: string; kind: string };
const style: Record<string, { cls: string; icon: any }> = {
  info: { cls: 'bg-brand-500/10 border-brand-500/20 text-brand-300', icon: Info },
  success: { cls: 'bg-success-500/10 border-success-500/20 text-success-400', icon: CheckCircle2 },
  warning: { cls: 'bg-warning-500/10 border-warning-500/20 text-warning-400', icon: AlertTriangle },
  danger: { cls: 'bg-error-500/10 border-error-500/20 text-error-400', icon: XOctagon },
};

export default function AnnouncementsBanner() {
  const [items, setItems] = useState<A[]>([]);
  const [hidden, setHidden] = useState<string[]>(() => { try { return JSON.parse(sessionStorage.getItem('hidden-ann') || '[]'); } catch { return []; } });
  useEffect(() => {
    const now = new Date().toISOString();
    supabase.from('announcements').select('id,title,body,kind').eq('is_active', true)
      .or(`starts_at.is.null,starts_at.lte.${now}`).or(`ends_at.is.null,ends_at.gte.${now}`).order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => setItems((data as A[]) || []));
  }, []);
  const visible = items.filter((a) => !hidden.includes(a.id));
  if (!visible.length) return null;
  const hide = (id: string) => { const n = [...hidden, id]; setHidden(n); try { sessionStorage.setItem('hidden-ann', JSON.stringify(n)); } catch { /* ignore */ } };
  return (
    <div className="space-y-2 mb-4">
      {visible.map((a) => { const s = style[a.kind] || style.info; const Icon = s.icon; return (
        <div key={a.id} className={`flex items-start gap-3 p-3 rounded-xl border text-sm ${s.cls}`}>
          <Icon className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0"><div className="font-medium">{a.title}</div>{a.body && <div className="opacity-90 whitespace-pre-line break-words">{a.body}</div>}</div>
          <button onClick={() => hide(a.id)} aria-label="Kapat" className="opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>); })}
    </div>
  );
}

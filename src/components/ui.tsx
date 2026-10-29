import { useEffect, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, X, ChevronLeft, ChevronRight } from 'lucide-react';

export type Notice = { ok: boolean; text: string } | null;

export function NoticeBar({ notice, onClose }: { notice: Notice; onClose?: () => void }) {
  if (!notice) return null;
  return (
    <div className={`p-3 rounded-xl border text-sm flex gap-2 items-start ${notice.ok ? 'bg-success-500/10 border-success-500/20 text-success-400' : 'bg-error-500/10 border-error-500/20 text-error-400'}`}>
      {notice.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
      <span className="break-words flex-1">{notice.text}</span>
      {onClose && <button onClick={onClose} className="shrink-0 opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>}
    </div>
  );
}

export function Modal({ open, title, onClose, children, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'} max-h-[92vh] overflow-y-auto bg-bg-surface border border-border-subtle rounded-t-2xl sm:rounded-2xl p-4 sm:p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-text-primary">{title}</h3>
          <button onClick={onClose} className="p-1 text-text-muted"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="flex items-center justify-between gap-2 text-sm text-text-secondary pt-3">
      <span>{page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} / {total}</span>
      <div className="flex items-center gap-1">
        <button disabled={page === 0} onClick={() => onPage(page - 1)} className="p-2 rounded-lg bg-bg-elevated disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
        <span className="px-2">{page + 1} / {pages}</span>
        <button disabled={page >= pages - 1} onClick={() => onPage(page + 1)} className="p-2 rounded-lg bg-bg-elevated disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

export const inputCls = 'w-full px-3 py-2 rounded-lg bg-bg-elevated border border-border-default text-sm text-text-primary focus:outline-none focus:border-brand-500';
export const btnPrimary = 'px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium disabled:opacity-50 inline-flex items-center justify-center gap-1.5';
export const btnGhost = 'px-3 py-2 rounded-lg bg-bg-elevated text-text-secondary hover:text-text-primary text-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-50';
export const btnDanger = 'px-3 py-2 rounded-lg bg-error-500/10 text-error-400 hover:bg-error-500/20 text-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-50';

export function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'ok' | 'warn' | 'bad' | 'brand' }) {
  const cls = { muted: 'bg-bg-hover text-text-muted', ok: 'bg-success-500/10 text-success-400', warn: 'bg-warning-500/10 text-warning-400', bad: 'bg-error-500/10 text-error-400', brand: 'bg-brand-500/10 text-brand-400' }[tone];
  return <span className={`px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${cls}`}>{children}</span>;
}

export const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleString() : '-');

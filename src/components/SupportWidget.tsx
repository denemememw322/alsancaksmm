import { useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PLATFORM_ICONS, PLATFORM_COLORS } from '@/components/BrandIcons';

type L = { id: string; platform: string; name: string; label: string; url: string };

// Yalnızca yöneticinin etkinleştirdiği ve iletişim bilgisi dolu bağlantılar gelir (URL sunucuda üretilir).
// Her bağlantı kendi platformunun ikonunu ve rengini kullanır.
export default function SupportWidget() {
  const [links, setLinks] = useState<L[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    supabase.rpc('get_support_links').then(({ data }) => setLinks(Array.isArray(data) ? (data as L[]) : []));
  }, []);
  if (links.length === 0) return null;
  return (
    <div className="fixed z-40 right-4 bottom-4 sm:right-6 sm:bottom-6 flex flex-col items-end gap-2" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {open && (
        <div className="w-72 max-w-[calc(100vw-2rem)] rounded-2xl bg-bg-surface border border-border-subtle shadow-2xl p-3 space-y-2">
          <div className="text-sm font-semibold text-text-primary px-1">Canlı destek</div>
          {links.map((l) => {
            const Icon = PLATFORM_ICONS[l.platform] || PLATFORM_ICONS.other;
            return (
              <a key={l.id} href={l.url} target={l.url.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer"
                className="flex items-center gap-3 p-2.5 rounded-xl bg-bg-elevated hover:bg-bg-hover transition-colors">
                <span className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0" style={{ backgroundColor: PLATFORM_COLORS[l.platform] || '#64748B' }}>
                  <Icon className="w-5 h-5" />
                </span>
                <span className="text-sm text-text-primary truncate">{l.label}</span>
              </a>
            );
          })}
        </div>
      )}
      <button onClick={() => setOpen(!open)} aria-label="Canlı destek" className="w-14 h-14 rounded-full bg-brand-600 hover:bg-brand-500 text-white shadow-xl flex items-center justify-center transition-colors">
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </div>
  );
}

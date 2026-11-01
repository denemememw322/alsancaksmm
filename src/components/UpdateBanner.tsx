import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

// Yeni sürüm yayınlandığında açık sekme eski paketle çalışmaya devam eder. Yalnızca gerçekten yeni sürüm
// varsa kullanıcıya haber verir; yenileme kullanıcının onayıyla yapılır (körü körüne tam sayfa yenilemesi yok).
const bundleOf = (html: string) => html.match(/\/assets\/index-[\w-]+\.js/)?.[0] ?? null;

export default function UpdateBanner() {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    const current = (document.querySelector('script[type="module"][src*="/assets/"]') as HTMLScriptElement | null)?.getAttribute('src');
    if (!current) return; // geliştirme ortamı
    const check = async () => {
      try {
        const r = await fetch('/index.html', { cache: 'no-store' });
        const latest = bundleOf(await r.text());
        if (latest && !current.endsWith(latest)) setStale(true);
      } catch { /* ağ hatası: sessiz geç */ }
    };
    const t = setInterval(check, 5 * 60 * 1000);
    const onVis = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, []);
  if (!stale) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-2rem)] flex items-center gap-3 px-4 py-3 rounded-xl bg-brand-600 text-white shadow-2xl text-sm">
      <span>Yeni sürüm yayınlandı.</span>
      <button onClick={() => window.location.reload()} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30"><RefreshCw className="w-4 h-4" /> Yenile</button>
    </div>
  );
}

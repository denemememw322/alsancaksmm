import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

// Sayfa içeriğini şu durumlarda sıfırdan yükler (tam uygulama yenilemesi olmadan):
//  - başka bir sayfaya geçildiğinde (aynı bileşen yeniden kullanılsa bile veri yeniden çekilir),
//  - geri tuşuyla tarayıcının bfcache'inden eski ekran geri getirildiğinde (ör. ödeme sayfasından dönüş),
//  - sekme 2 dakikadan uzun süre arka plandayken yeniden öne geldiğinde.
// Arama/filtre durumu URL'de olduğu için sayfa yenilense de korunur.
export default function RouteOutlet() {
  const loc = useLocation();
  const [tick, setTick] = useState(0);
  const hiddenAt = useRef(0);

  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) setTick((t) => t + 1); };
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > 120000) { hiddenAt.current = 0; setTick((t) => t + 1); }
    };
    window.addEventListener('pageshow', onShow);
    document.addEventListener('visibilitychange', onVis);
    return () => { window.removeEventListener('pageshow', onShow); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);

  return <Outlet key={`${loc.pathname}|${tick}`} />;
}

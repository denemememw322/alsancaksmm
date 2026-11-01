import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

// Filtre/arama/sayfa durumunu URL'de tutar: geri/ileri tuşları, yenileme ve paylaşılan bağlantı aynı görünümü açar.
export function useUrlState(key: string, def = ''): [string, (v: string) => void] {
  const [sp, setSp] = useSearchParams();
  const value = sp.get(key) ?? def;
  const set = useCallback((nv: string) => {
    setSp((prev) => {
      const n = new URLSearchParams(prev);
      if (!nv || nv === def) n.delete(key); else n.set(key, nv);
      return n;
    }, { replace: true });
  }, [key, def, setSp]);
  return [value, set];
}

export function useUrlPage(key = 'p'): [number, (p: number) => void] {
  const [v, set] = useUrlState(key, '0');
  const n = Math.max(0, parseInt(v, 10) || 0);
  return [n, (p: number) => set(String(Math.max(0, p)))];
}

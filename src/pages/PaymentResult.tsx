import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';

// Bu sayfaya dönmek ödemenin kanıtı DEĞİLDİR. Bakiye yalnızca sunucuya gelen imzalı
// bildirimle yüklenir; burada sadece güncel bakiyeyi yenileriz.
export default function PaymentResult() {
  const { pathname } = useLocation();
  const { refreshProfile } = useAuth();
  const failed = pathname.endsWith('/failed');

  useEffect(() => {
    refreshProfile();
    const t = setTimeout(refreshProfile, 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base p-6">
      <div className="max-w-md w-full p-8 rounded-2xl bg-bg-surface border border-border-subtle text-center space-y-4">
        {failed ? <XCircle className="w-12 h-12 text-error-400 mx-auto" /> : <CheckCircle2 className="w-12 h-12 text-success-400 mx-auto" />}
        <h1 className="font-display text-xl font-bold text-text-primary">{failed ? 'Ödeme tamamlanmadı' : 'Ödemen alındı'}</h1>
        <p className="text-sm text-text-secondary">
          {failed
            ? 'Ödeme işlemi tamamlanamadı. Para çekildiyse destek ile ödeme ID\'nle iletişime geç.'
            : 'Ödeme sağlayıcısının onayı geldiğinde bakiyen otomatik yüklenir. Bu birkaç dakika sürebilir.'}
        </p>
        <div className="flex gap-3 justify-center">
          <Link to="/dashboard/add-funds" className="px-4 py-2 rounded-lg bg-bg-elevated text-text-secondary text-sm">Bakiye Yükle</Link>
          <Link to="/dashboard/transactions" className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm">İşlemlerim</Link>
        </div>
      </div>
    </div>
  );
}

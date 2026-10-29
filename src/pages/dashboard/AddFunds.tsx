import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Bitcoin, Loader2, CheckCircle2, AlertCircle, Copy, Clock } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type Method = {
  id: string;
  kind: string;
  name: string;
  network: string | null;
  currency: string;
  address: string | null;
  qr_path: string | null;
  instructions: string | null;
  min_amount: number;
};

type Deposit = {
  id: string;
  public_id: string;
  method_id: string | null;
  provider: string | null;
  amount: number;
  status: string;
  created_at: string;
  expires_at?: string | null;
  cancel_reason?: string | null;
};

type Gateway = { provider: string; display_name: string };

const STATUS_TR: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Ödeme bekleniyor', cls: 'bg-warning-500/10 text-warning-400' },
  awaiting_review: { label: 'Kontrol bekliyor', cls: 'bg-brand-500/10 text-brand-400' },
  approved: { label: 'Onaylandı', cls: 'bg-success-500/10 text-success-400' },
  rejected: { label: 'Reddedildi', cls: 'bg-error-500/10 text-error-400' },
  cancelled: { label: 'İptal', cls: 'bg-bg-hover text-text-muted' },
};

const amounts = [10, 25, 50, 100, 250, 500];

export default function AddFunds() {
  const { profile, refreshProfile } = useAuth();
  const [methods, setMethods] = useState<Method[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [active, setActive] = useState<{ deposit: Deposit; method: Method } | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);

  const balance = profile?.balance ?? 0;

  const loadDeposits = async () => {
    if (!profile) return;
    await supabase.rpc('expire_deposit_requests');
    const { data } = await supabase
      .from('deposit_requests')
      .select('*')
      .eq('user_id', profile.user_id)
      .order('created_at', { ascending: false })
      .limit(10);
    setDeposits((data as Deposit[]) ?? []);
  };

  useEffect(() => {
    const t = setInterval(() => { loadDeposits(); }, 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.user_id]);

  useEffect(() => {
    (async () => {
      const [{ data: m }, { data: g }] = await Promise.all([
        supabase.from('payment_methods').select('*').eq('is_active', true).order('sort_order'),
        supabase.rpc('get_active_gateways'),
      ]);
      setMethods((m as Method[]) ?? []);
      setGateways((g as Gateway[]) ?? []);
    })();
    loadDeposits();
  }, [profile?.user_id]);

  const qrUrl = (path: string | null) =>
    path ? supabase.storage.from('payment-qr').getPublicUrl(path).data.publicUrl : null;

  const isGateway = (key: string) => key.startsWith('gw:');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = typeof amount === 'number' ? amount : parseFloat(String(amount));
    if (!selected || !amt || amt <= 0) return;
    setBusy(true);
    setMsg(null);
    setIframeUrl(null);
    setActive(null);

    if (isGateway(selected)) {
      const provider = selected.slice(3);
      const { data, error } = await supabase.functions.invoke(`${provider}-create`, { body: { amount: amt } });
      setBusy(false);
      if (error || data?.error) {
        setMsg({ ok: false, text: data?.error || error?.message || 'Ödeme başlatılamadı' });
        return;
      }
      if (data.payment_url) {
        // Kripto: sağlayıcının güvenli ödeme sayfasına yönlendir. Bakiye yalnızca sunucu doğrulamasıyla yüklenir.
        window.location.href = data.payment_url;
        return;
      }
      setIframeUrl(data.iframe_url);
      loadDeposits();
      return;
    }

    const { data, error } = await supabase.rpc('create_deposit_request', { p_method_id: selected, p_amount: amt });
    setBusy(false);
    if (error || data?.success === false) {
      setMsg({ ok: false, text: error?.message || data?.error || 'Talep oluşturulamadı' });
      return;
    }
    const method = methods.find((m) => m.id === selected)!;
    setActive({
      method,
      deposit: {
        id: data.id,
        public_id: data.payment_id,
        method_id: selected,
        provider: null,
        amount: amt,
        status: 'pending',
        created_at: new Date().toISOString(),
      },
    });
    loadDeposits();
  };

  const markPaid = async () => {
    if (!active) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('mark_deposit_paid', { p_id: active.deposit.id });
    setBusy(false);
    if (error || data?.success === false) {
      setMsg({ ok: false, text: error?.message || data?.error || 'İşlem başarısız' });
      return;
    }
    setActive({ ...active, deposit: { ...active.deposit, status: 'awaiting_review' } });
    loadDeposits();
  };

  const copy = (t: string) => navigator.clipboard?.writeText(t);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Bakiye Yükle</h1>
        <p className="text-text-secondary text-sm mt-1">Hesap bakiyeni yükle</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-gradient-to-br from-brand-600/20 to-accent-600/10 border border-brand-500/20 h-fit">
          <div className="text-sm text-text-secondary font-medium mb-1">Mevcut Bakiye</div>
          <div className="font-display text-4xl font-bold text-text-primary">${balance.toFixed(2)}</div>
          <button onClick={refreshProfile} className="mt-3 text-xs text-brand-400 hover:underline">Yenile</button>
        </div>

        <div className="lg:col-span-2 p-6 rounded-2xl bg-bg-surface border border-border-subtle">
          {msg && (
            <div className={`flex items-center gap-2 p-3 rounded-lg mb-4 text-sm ${msg.ok ? 'bg-success-500/10 border border-success-500/20 text-success-400' : 'bg-error-500/10 border border-error-500/20 text-error-400'}`}>
              {msg.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{msg.text}</span>
            </div>
          )}

          {!active && !iframeUrl && (
            <>
              <h2 className="font-semibold text-text-primary mb-4">Ödeme Yöntemi</h2>
              {methods.length === 0 && gateways.length === 0 && (
                <p className="text-sm text-text-muted mb-4">Şu an aktif ödeme yöntemi yok. Lütfen destek ile iletişime geç.</p>
              )}
              <div className="grid sm:grid-cols-2 gap-3 mb-6">
                {gateways.map((g) => (
                  <button key={g.provider} type="button" onClick={() => setSelected(`gw:${g.provider}`)}
                    className={`flex items-center gap-3 p-4 rounded-xl border text-left ${selected === `gw:${g.provider}` ? 'bg-brand-500/10 border-brand-500/40' : 'bg-bg-elevated border-border-subtle hover:border-border-default'}`}>
                    {g.provider === 'paymos' || g.provider === 'mercanpay' ? <Bitcoin className="w-5 h-5 text-brand-400" /> : <CreditCard className="w-5 h-5 text-brand-400" />}
                    <div className="font-medium text-text-primary text-sm">{g.display_name}</div>
                  </button>
                ))}
                {methods.map((m) => (
                  <button key={m.id} type="button" onClick={() => setSelected(m.id)}
                    className={`flex items-center gap-3 p-4 rounded-xl border text-left ${selected === m.id ? 'bg-brand-500/10 border-brand-500/40' : 'bg-bg-elevated border-border-subtle hover:border-border-default'}`}>
                    <Bitcoin className="w-5 h-5 text-brand-400" />
                    <div>
                      <div className="font-medium text-text-primary text-sm">{m.name}</div>
                      {m.network && <div className="text-xs text-text-muted">Ağ: {m.network}</div>}
                    </div>
                  </button>
                ))}
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Tutar (USD)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-medium">$</span>
                    <input type="number" value={amount} min="1" step="0.01" required placeholder="0.00"
                      onChange={(e) => setAmount(e.target.value ? parseFloat(e.target.value) : '')}
                      className="w-full pl-8 pr-4 py-3 rounded-xl bg-bg-elevated border border-border-default text-text-primary text-lg font-semibold focus:outline-none focus:border-brand-500" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {amounts.map((a) => (
                    <button key={a} type="button" onClick={() => setAmount(a)}
                      className="px-4 py-2 rounded-lg bg-bg-elevated border border-border-subtle text-text-secondary hover:text-text-primary text-sm font-medium">${a}</button>
                  ))}
                </div>
                <button type="submit" disabled={busy || !amount || !selected}
                  className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl">
                  {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Devam Et'}
                </button>
              </form>
            </>
          )}

          {iframeUrl && (
            <div>
              <h2 className="font-semibold text-text-primary mb-3">Kart ile ödeme</h2>
              <iframe src={iframeUrl} title="PayTR" className="w-full rounded-xl bg-white" style={{ height: 760, border: 0 }} />
              <p className="text-xs text-text-muted mt-3">Ödeme onaylanınca bakiyen otomatik yüklenir.</p>
              <button onClick={() => { setIframeUrl(null); refreshProfile(); }} className="mt-2 text-sm text-brand-400 hover:underline">Geri dön</button>
            </div>
          )}

          {active && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-text-primary">{active.method.name}</h2>
                <span className={`px-2 py-1 rounded-full text-xs ${STATUS_TR[active.deposit.status]?.cls}`}>{STATUS_TR[active.deposit.status]?.label}</span>
              </div>

              <div className="p-4 rounded-xl bg-bg-elevated border border-border-subtle">
                <div className="text-xs text-text-muted mb-1">Ödeme ID'n (destekle konuşurken bunu ilet)</div>
                <button onClick={() => copy(active.deposit.public_id)} className="flex items-center gap-2 font-mono text-xl font-bold text-text-primary">
                  {active.deposit.public_id} <Copy className="w-4 h-4 text-text-muted" />
                </button>
              </div>

              <div className="text-sm text-text-secondary">
                Gönderilecek tutar: <b className="text-text-primary">{active.deposit.amount} {active.method.currency}</b>
                {active.method.network && <> · Ağ: <b className="text-text-primary">{active.method.network}</b></>}
              </div>

              {active.method.address && (
                <div className="p-4 rounded-xl bg-bg-elevated border border-border-subtle">
                  <div className="text-xs text-text-muted mb-1">Adres</div>
                  <button onClick={() => copy(active.method.address!)} className="flex items-center gap-2 font-mono text-sm break-all text-left text-text-primary">
                    {active.method.address} <Copy className="w-4 h-4 shrink-0 text-text-muted" />
                  </button>
                </div>
              )}

              {qrUrl(active.method.qr_path) && (
                <img src={qrUrl(active.method.qr_path)!} alt="QR" className="w-48 h-48 rounded-xl bg-white p-2" />
              )}

              {active.method.instructions && <p className="text-sm text-text-secondary whitespace-pre-line">{active.method.instructions}</p>}

              <p className="text-xs text-warning-400">Yalnızca belirtilen ağı kullan. Yanlış ağa gönderilen ödemeler kaybolabilir.</p>

              {active.deposit.status === 'pending' ? (
                <button onClick={markPaid} disabled={busy}
                  className="w-full flex items-center justify-center gap-2 bg-success-500 hover:opacity-90 disabled:opacity-50 text-white font-semibold py-3 rounded-xl">
                  {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Ödemeyi Yaptım'}
                </button>
              ) : (
                <div className="p-4 rounded-xl bg-brand-500/10 border border-brand-500/20 text-sm text-text-primary space-y-2">
                  <div className="flex items-center gap-2 font-medium"><Clock className="w-4 h-4" /> Ödemen kontrol edilecek</div>
                  <p className="text-text-secondary">Canlı destek ile iletişime geçip <b>{active.deposit.public_id}</b> ID'sini ilet. Ödemeyi doğruladıktan sonra bakiyeni yükleyeceğiz.</p>
                  <Link to="/dashboard/support" className="inline-block text-brand-400 hover:underline">Canlı desteğe git →</Link>
                </div>
              )}
              <button onClick={() => setActive(null)} className="text-sm text-text-muted hover:underline">Kapat</button>
            </div>
          )}
        </div>
      </div>

      {deposits.length > 0 && (
        <div className="rounded-2xl bg-bg-surface border border-border-subtle overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle text-sm font-medium text-text-secondary">Son yükleme taleplerin</div>
          <table className="w-full text-sm">
            <tbody>
              {deposits.map((d) => (
                <tr key={d.id} className="border-b border-border-subtle last:border-0">
                  <td className="px-4 py-3 font-mono text-text-primary">{d.public_id}</td>
                  <td className="px-4 py-3 font-semibold text-text-primary">${Number(d.amount).toFixed(2)}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs ${STATUS_TR[d.status]?.cls}`}>{d.status === 'cancelled' && d.cancel_reason === 'expired' ? 'İptal (süre doldu)' : STATUS_TR[d.status]?.label ?? d.status}</span></td>
                  <td className="px-4 py-3 text-text-muted">{new Date(d.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

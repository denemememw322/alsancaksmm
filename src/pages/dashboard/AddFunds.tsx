import { useState } from 'react';
import { CreditCard, Wallet, Bitcoin, Landmark, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const methods = [
  { id: 'card', label: 'Credit Card', icon: CreditCard, desc: 'Visa, Mastercard, Amex' },
  { id: 'paypal', label: 'PayPal', icon: Wallet, desc: 'Instant transfer' },
  { id: 'crypto', label: 'Cryptocurrency', icon: Bitcoin, desc: 'BTC, ETH, USDT' },
  { id: 'bank', label: 'Bank Transfer', icon: Landmark, desc: '1-3 business days' },
];

const amounts = [10, 25, 50, 100, 250, 500];

export default function AddFunds() {
  const { profile } = useAuth();
  const [method, setMethod] = useState('card');
  const [amount, setAmount] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const balance = profile?.balance ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = typeof amount === 'number' ? amount : parseFloat(String(amount));
    if (!amt || amt <= 0) return;
    setSubmitting(true);
    setResult(null);
    const { data, error } = await supabase.rpc('request_deposit', { p_amount: amt, p_method: methods.find((m) => m.id === method)?.label ?? 'Card' });
    setSubmitting(false);
    if (error) {
      setResult({ ok: false, msg: error.message });
    } else if (data && data.success === false) {
      setResult({ ok: false, msg: data.error });
    } else if (data && data.success === true) {
      setResult({ ok: true, msg: `$${amt.toFixed(2)} talebin alındı ve onay bekliyor. Onaylanınca bakiyene eklenecek.` });
      setAmount('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Add Funds</h1>
        <p className="text-text-secondary text-sm mt-1">Top up your account balance</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Balance */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-brand-600/20 to-accent-600/10 border border-brand-500/20">
          <div className="text-sm text-text-secondary font-medium mb-1">Current Balance</div>
          <div className="font-display text-4xl font-bold text-text-primary">${balance.toFixed(2)}</div>
          <div className="mt-4 pt-4 border-t border-border-subtle space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Total Spent</span>
              <span className="text-text-primary font-medium">${(profile?.total_spent ?? 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Level</span>
              <span className="text-text-primary font-medium">{profile?.level ?? 'Standard'}</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-bg-surface border border-border-subtle">
          {result && (
            <div className={`flex items-center gap-2 p-3 rounded-lg mb-4 text-sm ${
              result.ok ? 'bg-success-500/10 border border-success-500/20 text-success-400' : 'bg-error-500/10 border border-error-500/20 text-error-400'
            }`}>
              {result.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{result.msg}</span>
            </div>
          )}

          <h2 className="font-semibold text-text-primary mb-4">Choose Payment Method</h2>
          <div className="grid sm:grid-cols-2 gap-3 mb-6">
            {methods.map((m) => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                  method === m.id ? 'bg-brand-500/10 border-brand-500/40' : 'bg-bg-elevated border-border-subtle hover:border-border-default'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${method === m.id ? 'bg-brand-500/20' : 'bg-bg-hover'}`}>
                  <m.icon className={`w-5 h-5 ${method === m.id ? 'text-brand-400' : 'text-text-secondary'}`} />
                </div>
                <div>
                  <div className="font-medium text-text-primary text-sm">{m.label}</div>
                  <div className="text-xs text-text-muted">{m.desc}</div>
                </div>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-medium">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value ? parseFloat(e.target.value) : '')}
                  placeholder="0.00"
                  min="1"
                  step="0.01"
                  required
                  className="w-full pl-8 pr-4 py-3 rounded-xl bg-bg-elevated border border-border-default text-text-primary text-lg font-semibold placeholder:text-text-muted focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {amounts.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAmount(a)}
                  className="px-4 py-2 rounded-lg bg-bg-elevated border border-border-subtle text-text-secondary hover:text-text-primary hover:border-brand-500/40 text-sm font-medium transition-colors"
                >
                  ${a}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={submitting || !amount}
              className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : `Request $${(typeof amount === 'number' ? amount : 0).toFixed(2)} top-up`}
            </button>
            <p className="text-xs text-text-muted text-center">Your balance is added after an admin reviews and approves this request.</p>
          </form>
        </div>
      </div>
    </div>
  );
}

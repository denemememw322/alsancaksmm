import { useEffect, useState, useMemo } from 'react';
import { ShoppingCart, Search, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase, type Service } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Link } from 'react-router-dom';

export default function NewOrder() {
  const { profile, refreshProfile } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState<Service | null>(null);
  const [link, setLink] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Supabase servislerini çek (elle eklenenler + Ayarlar'dan senkronize edilenler, hepsi burada)
  useEffect(() => {
    supabase
      .from('services')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .then(({ data }) => {
        setServices((data as Service[]) ?? []);
        setLoading(false);
      });
  }, []);

  const categories = useMemo(() => {
    const set = new Set(services.map((s) => s.category));
    return ['All', ...Array.from(set)];
  }, [services]);

  const filtered = useMemo(() => {
    return services.filter((s) => {
      const matchCat = category === 'All' || s.category === category;
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [services, search, category]);

  const charge = selected ? ((quantity / 1000) * selected.rate_per_1000) : 0;
  const balance = profile?.balance ?? 0;
  const insufficient = charge > balance;
  const qtyValid = selected && quantity >= selected.min_order && quantity <= selected.max_order;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !link || !qtyValid) return;
    setSubmitting(true);
    setResult(null);

    const { data, error } = await supabase.rpc('place_order', {
      p_service_id: selected.id,
      p_link: link,
      p_quantity: quantity,
    });

    if (error) {
      setSubmitting(false);
      setResult({ ok: false, msg: error.message });
      return;
    }
    if (data && data.success === false) {
      setSubmitting(false);
      setResult({ ok: false, msg: data.error });
      return;
    }

    // Sipariş yerelde oluştu ve bakiye düşüldü. Servis bir API sağlayıcısından
    // senkronize edilmişse şimdi gerçek sağlayıcıya da ilet.
    let forwardMsg = '';
    if (selected.provider_id && selected.original_id) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        const res = await fetch('/api/provider-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ order_id: data.order_uuid }),
        });
        const forward = await res.json();

        if (forward.success && forward.forwarded) {
          forwardMsg = ' · Sağlayıcıya iletildi ✅';
        } else if (forward.success && !forward.forwarded) {
          forwardMsg = '';
        } else {
          forwardMsg = ` · ⚠️ Sağlayıcıya iletilemedi: ${forward.error || 'bilinmeyen hata'}`;
        }
      } catch (e: any) {
        forwardMsg = ` · ⚠️ Sağlayıcıya iletilemedi: ${e.message || 'ağ hatası'}`;
      }
    }

    setSubmitting(false);
    setResult({
      ok: true,
      msg: `Order #${data.order_id} placed successfully! $${Number(data.charge).toFixed(2)} charged.${forwardMsg}`,
    });
    await refreshProfile();
    setSelected(null);
    setLink('');
    setQuantity(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">New Order</h1>
          <p className="text-text-secondary text-sm mt-1">Select a service and place your order</p>
        </div>
      </div>

      {result && (
        <div className={`flex items-center gap-2 p-4 rounded-xl border text-sm ${
          result.ok
            ? 'bg-success-500/10 border-success-500/20 text-success-400'
            : 'bg-error-500/10 border-error-500/20 text-error-400'
        }`}>
          {result.ok ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span>{result.msg}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search services..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-bg-surface border border-border-default text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500 transition-colors"
              />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  category === c ? 'bg-brand-600 text-white' : 'bg-bg-surface text-text-secondary border border-border-subtle'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin pr-1">
            {loading ? (
              [...Array(6)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-bg-surface animate-pulse" />)
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-text-muted">
                <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No services found
              </div>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSelected(s); setQuantity(s.min_order); setResult(null); }}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    selected?.id === s.id
                      ? 'bg-brand-500/10 border-brand-500/40'
                      : 'bg-bg-surface border-border-subtle hover:border-border-default'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-text-primary">{s.name}</div>
                      <div className="text-xs text-text-muted mt-0.5">
                        {s.category} · {s.avg_time}
                        {s.type === 'API' && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 text-[10px]">
                            🔌 API
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-brand-400">${s.rate_per_1000.toFixed(2)}</div>
                      <div className="text-xs text-text-muted">per 1K</div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="sticky top-24 p-5 rounded-2xl bg-bg-surface border border-border-subtle">
            <h2 className="font-semibold text-text-primary mb-4">Order Details</h2>
            {!selected ? (
              <div className="text-center py-10 text-text-muted">
                <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Select a service to place an order</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="p-3 rounded-lg bg-bg-elevated">
                  <div className="text-sm font-medium text-text-primary">{selected.name}</div>
                  <div className="text-xs text-text-muted mt-0.5">
                    {selected.category} · {selected.avg_time}
                    {selected.type === 'API' && <span className="ml-2 text-brand-400">🔌 API Service</span>}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Link</label>
                  <input
                    type="url"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://instagram.com/..."
                    required
                    className="w-full px-3 py-2.5 rounded-xl bg-bg-elevated border border-border-default text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    Quantity (min {selected.min_order}, max {selected.max_order.toLocaleString()})
                  </label>
                  <input
                    type="number"
                    value={quantity || ''}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                    min={selected.min_order}
                    max={selected.max_order}
                    required
                    className="w-full px-3 py-2.5 rounded-xl bg-bg-elevated border border-border-default text-text-primary focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>
                <div className="space-y-2 p-4 rounded-xl bg-bg-elevated">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Charge</span>
                    <span className="font-semibold text-text-primary">${charge.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Balance</span>
                    <span className={`font-semibold ${insufficient ? 'text-error-400' : 'text-text-primary'}`}>${balance.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-border-subtle">
                    <span className="text-text-secondary">After order</span>
                    <span className="font-semibold text-text-primary">${(balance - charge).toFixed(2)}</span>
                  </div>
                </div>
                {insufficient && (
                  <Link to="/dashboard/add-funds" className="block text-center text-sm text-brand-400 hover:text-brand-300">
                    Insufficient balance — Add funds
                  </Link>
                )}
                <button
                  type="submit"
                  disabled={submitting || !qtyValid || !link || insufficient}
                  className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Place Order'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

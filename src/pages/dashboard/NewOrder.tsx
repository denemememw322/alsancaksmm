import { useEffect, useState, useMemo } from 'react';
import { ShoppingCart, Search, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase, type Service, CUSTOM_TYPES } from '@/lib/supabase';
import { forwardOrders } from '@/lib/providerApi';
import { useAuth } from '@/lib/auth';
import { Link } from 'react-router-dom';

const lineCount = (t: string) => t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).length;

export default function NewOrder() {
  const { profile, refreshProfile } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [catOrder, setCatOrder] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState<Service | null>(null);
  const [link, setLink] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [comments, setComments] = useState('');
  const [clientRef, setClientRef] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: cats }, { data: svc }] = await Promise.all([
        supabase.from('categories').select('name,sort_order,is_active'),
        (async () => {
          const all: Service[] = [];
          for (let from = 0; ; from += 1000) {
            const { data } = await supabase.from('services').select('*').eq('is_active', true).order('service_id').range(from, from + 999);
            all.push(...((data as Service[]) || []));
            if (!data || data.length < 1000) break;
          }
          return { data: all };
        })(),
      ]);
      const hidden = new Set((cats || []).filter((c: any) => !c.is_active).map((c: any) => c.name));
      setCatOrder(Object.fromEntries((cats || []).map((c: any) => [c.name, c.sort_order])));
      setServices((svc || []).filter((s) => !hidden.has(s.category)));
      setLoading(false);
    })();
  }, []);

  const categories = useMemo(() => {
    const set = Array.from(new Set(services.map((s) => s.category)));
    set.sort((a, b) => (catOrder[a] ?? 999) - (catOrder[b] ?? 999) || a.localeCompare(b));
    return ['All', ...set];
  }, [services, catOrder]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return services.filter((s) => (category === 'All' || s.category === category) && (!q || s.name.toLowerCase().includes(q) || String(s.service_id) === q)).slice(0, 300);
  }, [services, search, category]);

  const isCustom = !!selected && CUSTOM_TYPES.includes(selected.service_type || '');
  const commentsCount = lineCount(comments);
  const effectiveQty = selected && selected.service_type === 'Custom Comments' ? commentsCount : quantity;
  const charge = selected ? (effectiveQty / 1000) * selected.rate_per_1000 : 0;
  const balance = profile?.balance ?? 0;
  const insufficient = charge > balance;
  const qtyValid = !!selected && effectiveQty >= selected.min_order && effectiveQty <= selected.max_order && (!isCustom || commentsCount > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !link || !qtyValid) return;
    setSubmitting(true);
    setResult(null);

    const { data, error } = await supabase.rpc('place_order', {
      p_service_id: selected.id, p_link: link, p_quantity: effectiveQty, p_client_ref: clientRef, p_comments: isCustom ? comments : null,
    });
    if (error || (data && data.success === false)) {
      setSubmitting(false);
      setResult({ ok: false, msg: error?.message || data.error });
      return;
    }

    setClientRef(crypto.randomUUID());
    let forwardMsg = '';
    if (selected.provider_id && selected.original_id) {
      try {
        const r = await forwardOrders([data.order_uuid]);
        const f = r?.results?.[0];
        if (f?.forwarded) forwardMsg = ' · Siparişin işleme alındı ✅';
        else if (f && f.success === false) forwardMsg = ` · ⚠️ Sağlayıcıya iletilemedi (${f.error || 'bilinmeyen hata'}). Siparişin bekleme listesine alındı, destek ekibi ilgilenecek.`;
      } catch { forwardMsg = ' · Sipariş sıraya alındı, birkaç dakika içinde iletilecek.'; }
    }

    setSubmitting(false);
    setResult({ ok: true, msg: `Order #${data.order_id} placed successfully! $${Number(data.charge).toFixed(2)} charged.${forwardMsg}` });
    await refreshProfile();
    setSelected(null); setLink(''); setQuantity(0); setComments('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">New Order</h1>
        <p className="text-text-secondary text-sm mt-1">Select a service and place your order</p>
      </div>

      {result && (
        <div className={`flex items-center gap-2 p-4 rounded-xl border text-sm ${result.ok ? 'bg-success-500/10 border-success-500/20 text-success-400' : 'bg-error-500/10 border-error-500/20 text-error-400'}`}>
          {result.ok ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span className="break-words">{result.msg}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-3 order-2 lg:order-1 min-w-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search services or ID..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-bg-surface border border-border-default text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500 transition-colors" />
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
            {categories.map((c) => (
              <button key={c} onClick={() => setCategory(c)} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${category === c ? 'bg-brand-600 text-white' : 'bg-bg-surface text-text-secondary border border-border-subtle'}`}>{c}</button>
            ))}
          </div>

          <div className="space-y-2 max-h-[560px] overflow-y-auto scrollbar-thin pr-1">
            {loading ? [...Array(6)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-bg-surface animate-pulse" />)
              : filtered.length === 0 ? (<div className="text-center py-10 text-text-muted"><ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-50" />No services found</div>)
              : filtered.map((s) => (
                <button key={s.id} onClick={() => { setSelected(s); setQuantity(s.min_order); setComments(''); setResult(null); }}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${selected?.id === s.id ? 'bg-brand-500/10 border-brand-500/40' : 'bg-bg-surface border-border-subtle hover:border-border-default'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-text-primary break-words"><span className="text-text-muted text-xs mr-1.5">#{s.service_id}</span>{s.name}</div>
                      <div className="text-xs text-text-muted mt-0.5 flex flex-wrap gap-1.5 items-center">
                        <span>{s.category}</span>{s.avg_time && <span>· {s.avg_time}</span>}
                        {CUSTOM_TYPES.includes(s.service_type || '') && <span className="px-1.5 py-0.5 rounded bg-warning-500/10 text-warning-400 text-[10px]">Custom</span>}
                        {s.refill_enabled && <span className="px-1.5 py-0.5 rounded bg-success-500/10 text-success-400 text-[10px]">♻ Refill{s.refill_days ? ` ${s.refill_days}d` : ' ∞'}</span>}
                        {s.cancel_enabled && <span className="px-1.5 py-0.5 rounded bg-bg-hover text-text-muted text-[10px]">Cancel</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0"><div className="font-semibold text-brand-400">${s.rate_per_1000.toFixed(2)}</div><div className="text-xs text-text-muted">per 1K</div></div>
                  </div>
                </button>))}
          </div>
        </div>

        <div className="lg:col-span-2 order-1 lg:order-2">
          <div className="lg:sticky lg:top-24 p-5 rounded-2xl bg-bg-surface border border-border-subtle">
            <h2 className="font-semibold text-text-primary mb-4">Order Details</h2>
            {!selected ? (
              <div className="text-center py-10 text-text-muted"><ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">Select a service to place an order</p></div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="p-3 rounded-lg bg-bg-elevated">
                  <div className="text-sm font-medium text-text-primary break-words">{selected.name}</div>
                  <div className="text-xs text-text-muted mt-0.5">{selected.category}{selected.avg_time ? ` · ${selected.avg_time}` : ''}</div>
                  {selected.description && <div className="text-xs text-text-secondary mt-2 whitespace-pre-line break-words">{selected.description}</div>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Link</label>
                  <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." required
                    className="w-full px-3 py-2.5 rounded-xl bg-bg-elevated border border-border-default text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500 transition-colors" />
                </div>
                {isCustom && (
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Comments <span className="text-text-muted font-normal">(one per line · {commentsCount} lines)</span></label>
                    <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={6} required placeholder={'Great video!\nLove this content\n...'}
                      className="w-full px-3 py-2.5 rounded-xl bg-bg-elevated border border-border-default text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500 transition-colors" />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Quantity (min {selected.min_order}, max {selected.max_order.toLocaleString()})</label>
                  {selected.service_type === 'Custom Comments' ? (
                    <input readOnly value={commentsCount} className="w-full px-3 py-2.5 rounded-xl bg-bg-elevated border border-border-default text-text-secondary" />
                  ) : (
                    <input type="number" value={quantity || ''} onChange={(e) => setQuantity(parseInt(e.target.value) || 0)} min={selected.min_order} max={selected.max_order} required
                      className="w-full px-3 py-2.5 rounded-xl bg-bg-elevated border border-border-default text-text-primary focus:outline-none focus:border-brand-500 transition-colors" />
                  )}
                </div>
                <div className="space-y-2 p-4 rounded-xl bg-bg-elevated">
                  <div className="flex justify-between text-sm"><span className="text-text-secondary">Charge</span><span className="font-semibold text-text-primary">${charge.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-text-secondary">Balance</span><span className={`font-semibold ${insufficient ? 'text-error-400' : 'text-text-primary'}`}>${balance.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm pt-2 border-t border-border-subtle"><span className="text-text-secondary">After order</span><span className="font-semibold text-text-primary">${(balance - charge).toFixed(2)}</span></div>
                </div>
                {insufficient && <Link to="/dashboard/add-funds" className="block text-center text-sm text-brand-400 hover:text-brand-300">Insufficient balance — Add funds</Link>}
                <button type="submit" disabled={submitting || !qtyValid || !link || insufficient}
                  className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors">
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

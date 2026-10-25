import { useEffect, useState, useMemo } from 'react';
import { Search, Package } from 'lucide-react';
import { supabase, type Service } from '@/lib/supabase';

export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

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
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.platform.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [services, search, category]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Services</h1>
        <p className="text-text-secondary text-sm mt-1">Browse our full catalog of {services.length} services</p>
      </div>

      {/* Filters */}
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
        <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                category === c
                  ? 'bg-brand-600 text-white'
                  : 'bg-bg-surface text-text-secondary hover:text-text-primary border border-border-subtle'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-bg-surface border border-border-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-text-muted text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">ID</th>
                <th className="text-left px-4 py-3 font-medium">Service</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Category</th>
                <th className="text-left px-4 py-3 font-medium">Min / Max</th>
                <th className="text-left px-4 py-3 font-medium">Rate / 1K</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Avg Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-border-subtle">
                    {[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-5 rounded bg-bg-elevated animate-pulse" /></td>)}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-text-muted">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No services found
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="border-b border-border-subtle hover:bg-bg-elevated transition-colors">
                    <td className="px-4 py-3 text-text-muted">#{s.service_id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-primary">{s.name}</div>
                      {s.description && <div className="text-xs text-text-muted mt-0.5 line-clamp-1">{s.description}</div>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="px-2 py-0.5 rounded-md bg-bg-elevated text-text-secondary text-xs">{s.category}</span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{s.min_order} / {s.max_order.toLocaleString()}</td>
                    <td className="px-4 py-3 font-semibold text-brand-400">${s.rate_per_1000.toFixed(2)}</td>
                    <td className="px-4 py-3 text-text-secondary hidden md:table-cell">{s.avg_time ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

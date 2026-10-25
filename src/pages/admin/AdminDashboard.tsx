import { useEffect, useState } from 'react';
import { Users, ShoppingBag, TrendingUp, DollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    users: 0,
    orders: 0,
    revenue: 0,
    services: 0,
  });

  useEffect(() => {
    (async () => {
      const [users, orders, revenue, services] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('charge'),
        supabase.from('services').select('*', { count: 'exact', head: true }),
      ]);

      setStats({
        users: users.count || 0,
        orders: orders.count || 0,
        revenue: (revenue.data || []).reduce((acc, o) => acc + o.charge, 0),
        services: services.count || 0,
      });
    })();
  }, []);

  const cards = [
    { label: 'Total Users', value: stats.users, icon: Users, color: 'text-blue-400' },
    { label: 'Total Orders', value: stats.orders, icon: ShoppingBag, color: 'text-green-400' },
    { label: 'Revenue', value: `$${stats.revenue.toFixed(2)}`, icon: DollarSign, color: 'text-yellow-400' },
    { label: 'Services', value: stats.services, icon: TrendingUp, color: 'text-purple-400' },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-text-primary">Admin Dashboard</h1>
      <p className="text-text-secondary text-sm mt-1">Manage your SMM panel</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {cards.map((c) => (
          <div key={c.label} className="p-5 rounded-2xl bg-bg-surface border border-border-subtle">
            <c.icon className={`w-5 h-5 ${c.color} mb-2`} />
            <div className="font-display text-2xl font-bold text-text-primary">{c.value}</div>
            <div className="text-sm text-text-muted">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

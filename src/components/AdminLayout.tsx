import { Outlet, NavLink, Link } from 'react-router-dom';
import { 
  LayoutDashboard, Users, ShoppingBag, TrendingUp, 
  Settings, LogOut, Shield, Banknote 
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

const adminNav = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/admin/deposits', label: 'Deposits', icon: Banknote },
  { to: '/admin/services', label: 'Services', icon: TrendingUp },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-bg-base">
      <aside className="fixed inset-y-0 left-0 w-64 bg-bg-surface border-r border-border-subtle p-4">
        <Link to="/admin" className="flex items-center gap-2 mb-8">
          <Shield className="w-6 h-6 text-brand-400" />
          <span className="font-bold text-text-primary">Admin Panel</span>
        </Link>
        
        <nav className="space-y-1">
          {adminNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-500/10 text-brand-300'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={signOut}
          className="mt-6 w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-error-400 hover:bg-error-500/5 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </aside>

      <div className="lg:pl-64">
        <main className="p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

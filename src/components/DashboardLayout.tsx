import { useState } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import {
  TrendingUp, LayoutDashboard, Package, ShoppingCart, ListOrdered,
  Wallet, Receipt, LifeBuoy, Gift, LogOut, Menu, X, Wallet as WalletIcon,
  Shield, Webhook,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/dashboard/services', label: 'Services', icon: Package },
  { to: '/dashboard/new-order', label: 'New Order', icon: ShoppingCart },
  { to: '/dashboard/orders', label: 'My Orders', icon: ListOrdered },
  { to: '/dashboard/add-funds', label: 'Add Funds', icon: Wallet },
  { to: '/dashboard/transactions', label: 'Transactions', icon: Receipt },
  { to: '/dashboard/affiliate', label: 'Affiliate', icon: Gift },
  { to: '/dashboard/api', label: 'API', icon: Webhook },
  { to: '/dashboard/support', label: 'Support', icon: LifeBuoy },
];

export default function DashboardLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const balance = profile?.balance ?? 0;
  const isAdmin = (profile as any)?.role === 'admin';

  const allNavItems = isAdmin 
    ? [...navItems, { to: '/admin', label: 'Admin Panel', icon: Shield }]
    : navItems;

  const SidebarContent = () => (
    <>
      <Link to="/dashboard" className="flex items-center gap-2.5 px-2 mb-8">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <span className="font-display text-lg font-bold text-text-primary">BoostPanel</span>
      </Link>

      <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-brand-600/20 to-accent-600/10 border border-brand-500/20">
        <div className="flex items-center gap-2 text-text-secondary text-xs font-medium mb-1">
          <WalletIcon className="w-3.5 h-3.5" />
          Account Balance
        </div>
        <div className="font-display text-2xl font-bold text-text-primary">
          ${balance.toFixed(2)}
        </div>
        <Link
          to="/dashboard/add-funds"
          className="mt-3 block text-center text-sm font-medium bg-brand-600 hover:bg-brand-500 text-white py-2 rounded-lg transition-colors"
        >
          Add Funds
        </Link>
      </div>

      <nav className="space-y-1">
        {allNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-500/10 text-brand-300 border border-brand-500/20'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent'
              }`
            }
          >
            <item.icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={handleSignOut}
        className="mt-6 w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-error-400 hover:bg-error-500/5 transition-colors"
      >
        <LogOut className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
        Sign out
      </button>
    </>
  );

  return (
    <div className="min-h-screen bg-bg-base">
      <aside className="fixed inset-y-0 left-0 w-64 bg-bg-surface border-r border-border-subtle p-4 hidden lg:flex flex-col z-30">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-bg-surface border-r border-border-subtle p-4 flex flex-col animate-slide-up">
            <button onClick={() => setMobileOpen(false)} className="self-end mb-2 text-text-muted">
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 glass border-b border-border-subtle h-16 flex items-center justify-between px-4 sm:px-6">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden text-text-secondary">
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden lg:block text-sm text-text-secondary">
            Welcome back, <span className="font-medium text-text-primary">{profile?.username || profile?.email || 'User'}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-elevated border border-border-subtle">
              <WalletIcon className="w-4 h-4 text-brand-400" />
              <span className="text-sm font-semibold text-text-primary">${balance.toFixed(2)}</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white font-semibold text-sm">
              {(profile?.username || profile?.email || 'U').charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

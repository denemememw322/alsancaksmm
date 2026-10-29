import { useState } from 'react';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, ShoppingBag, TrendingUp, Settings, LogOut, Shield, Banknote, Plug, Menu, X,
  Tags, Link2, RotateCcw, RefreshCw, BarChart3, Megaphone, MessageCircle, KeyRound, CreditCard, ArrowLeft,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

const adminNav = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Kullanıcılar', icon: Users, perm: 'users.view' },
  { to: '/admin/orders', label: 'Siparişler', icon: ShoppingBag, perm: 'orders.view' },
  { to: '/admin/refunds', label: 'İadeler', icon: RotateCcw, perm: 'orders.view' },
  { to: '/admin/refills', label: 'Refill / İptal', icon: RefreshCw, perm: 'orders.view' },
  { to: '/admin/deposits', label: 'Bakiye Talepleri', icon: Banknote, perm: 'deposits.review' },
  { to: '/admin/payments', label: 'Ödeme Ayarları', icon: CreditCard, perm: 'payments.manage' },
  { to: '/admin/providers', label: 'API Sağlayıcılar', icon: Plug, perm: 'providers.manage' },
  { to: '/admin/services', label: 'Hizmetler', icon: TrendingUp, perm: 'services.manage' },
  { to: '/admin/categories', label: 'Kategoriler', icon: Tags, perm: 'services.manage' },
  { to: '/admin/mappings', label: 'Hizmet ID Eşleştirme', icon: Link2, perm: 'services.manage' },
  { to: '/admin/reports', label: 'Raporlar', icon: BarChart3, perm: 'reports.view' },
  { to: '/admin/announcements', label: 'Duyurular', icon: Megaphone, perm: 'announcements.manage' },
  { to: '/admin/support-links', label: 'Canlı Destek', icon: MessageCircle, perm: 'support_links.manage' },
  { to: '/admin/roles', label: 'Roller / İzinler', icon: KeyRound, perm: 'roles.manage' },
  { to: '/admin/settings', label: 'Ayarlar', icon: Settings, perm: 'settings.manage' },
] as { to: string; label: string; icon: any; perm?: string; end?: boolean }[];

export default function AdminLayout() {
  const { signOut, can, profile } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const items = adminNav.filter((i) => !i.perm || can(i.perm));

  const Nav = () => (
    <>
      <Link to="/admin" className="flex items-center gap-2 mb-6 px-1" onClick={() => setOpen(false)}>
        <Shield className="w-6 h-6 text-brand-400" />
        <div>
          <div className="font-bold text-text-primary leading-tight">Admin Panel</div>
          <div className="text-[11px] text-text-muted capitalize">{(profile as any)?.role}</div>
        </div>
      </Link>
      <nav className="space-y-1 flex-1 overflow-y-auto pr-1">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)}
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive ? 'bg-brand-500/10 text-brand-300' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'}`}>
            <item.icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="pt-3 mt-3 border-t border-border-subtle space-y-1">
        <Link to="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover">
          <ArrowLeft className="w-4 h-4" /> Kullanıcı paneli
        </Link>
        <button onClick={async () => { await signOut(); navigate('/'); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-error-400 hover:bg-error-500/5 transition-colors">
          <LogOut className="w-4 h-4" /> Çıkış
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-bg-base">
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-bg-surface border-r border-border-subtle p-4 flex-col z-30">
        <Nav />
      </aside>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-bg-surface border-r border-border-subtle p-4 flex flex-col">
            <button onClick={() => setOpen(false)} className="self-end mb-2 text-text-muted"><X className="w-5 h-5" /></button>
            <Nav />
          </aside>
        </div>
      )}

      <div className="lg:pl-64 min-w-0">
        <header className="lg:hidden sticky top-0 z-20 bg-bg-surface/90 backdrop-blur border-b border-border-subtle h-14 flex items-center gap-3 px-4">
          <button onClick={() => setOpen(true)} className="text-text-secondary"><Menu className="w-5 h-5" /></button>
          <Shield className="w-5 h-5 text-brand-400" />
          <span className="font-semibold text-text-primary">Admin Panel</span>
        </header>
        <main className="p-4 sm:p-6 lg:p-8 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

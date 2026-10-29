import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth';
import Landing from '@/pages/Landing';
import SignIn from '@/pages/SignIn';
import SignUp from '@/pages/SignUp';
import DashboardLayout from '@/components/DashboardLayout';
import Dashboard from '@/pages/dashboard/Dashboard';
import NewOrder from '@/pages/dashboard/NewOrder';
import Orders from '@/pages/dashboard/Orders';
import Services from '@/pages/dashboard/Services';
import AddFunds from '@/pages/dashboard/AddFunds';
import Transactions from '@/pages/dashboard/Transactions';
import Support from '@/pages/dashboard/Support';
import Affiliate from '@/pages/dashboard/Affiliate';
import Api from '@/pages/dashboard/Api';

// Admin Importları
import AdminLayout from '@/components/AdminLayout';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminUsers from '@/pages/admin/AdminUsers';
import AdminOrders from '@/pages/admin/AdminOrders';
import AdminDeposits from '@/pages/admin/AdminDeposits';
import AdminServices from '@/pages/admin/AdminServices';
import AdminSettings from '@/pages/admin/AdminSettings';
import PaymentResult from '@/pages/PaymentResult';
import AdminPayments from '@/pages/admin/AdminPayments';
import AdminProviders from '@/pages/admin/AdminProviders';
import AdminCategories from '@/pages/admin/AdminCategories';
import AdminMappings from '@/pages/admin/AdminMappings';
import AdminRefunds from '@/pages/admin/AdminRefunds';
import AdminRefills from '@/pages/admin/AdminRefills';
import AdminReports from '@/pages/admin/AdminReports';
import AdminAnnouncements from '@/pages/admin/AdminAnnouncements';
import AdminSupportLinks from '@/pages/admin/AdminSupportLinks';
import AdminRoles from '@/pages/admin/AdminRoles';
import BulkOrder from '@/pages/dashboard/BulkOrder';

import type { JSX } from 'react';

function ProtectedRoute({ children }: { children: JSX.Element }) {
    const { session, loading } = useAuth();
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-bg-base">
                <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }
    if (!session) return <Navigate to="/signin" replace />;
    return children;
}

function AdminRoute({ children }: { children: JSX.Element }) {
    const { profile, loading, isStaff } = useAuth();
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-bg-base">
                <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }
    if (!profile || !isStaff) return <Navigate to="/dashboard" replace />;
    return children;
}

// Yalnızca arayüzü gizlemekle kalmaz: izin yoksa sayfa hiç açılmaz (asıl koruma veritabanı RLS/RPC'sindedir)
function Guard({ perm, children }: { perm: string; children: JSX.Element }) {
    const { can } = useAuth();
    if (!can(perm)) return <Navigate to="/admin" replace />;
    return children;
}

function AppRoutes() {
    const { session, loading } = useAuth();
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-bg-base">
                <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }
    return (
        <Routes>
            <Route path="/" element={session ? <Navigate to="/dashboard" replace /> : <Landing />} />
            <Route path="/signin" element={session ? <Navigate to="/dashboard" replace /> : <SignIn />} />
            <Route path="/signup" element={session ? <Navigate to="/dashboard" replace /> : <SignUp />} />

            <Route path="/payment/success" element={<ProtectedRoute><PaymentResult /></ProtectedRoute>} />
            <Route path="/payment/failed" element={<ProtectedRoute><PaymentResult /></ProtectedRoute>} />

            {/* Dashboard Routes */}
            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute>
                        <DashboardLayout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<Dashboard />} />
                <Route path="services" element={<Services />} />
                <Route path="new-order" element={<NewOrder />} />
                <Route path="orders" element={<Orders />} />
                <Route path="bulk-order" element={<BulkOrder />} />
                <Route path="add-funds" element={<AddFunds />} />
                <Route path="transactions" element={<Transactions />} />
                <Route path="support" element={<Support />} />
                <Route path="affiliate" element={<Affiliate />} />
                <Route path="api" element={<Api />} />
            </Route>

            {/* Admin Routes */}
            <Route
                path="/admin"
                element={
                    <AdminRoute>
                        <AdminLayout />
                    </AdminRoute>
                }
            >
                <Route index element={<AdminDashboard />} />
                <Route path="users" element={<Guard perm="users.view"><AdminUsers /></Guard>} />
                <Route path="orders" element={<Guard perm="orders.view"><AdminOrders /></Guard>} />
                <Route path="refunds" element={<Guard perm="orders.view"><AdminRefunds /></Guard>} />
                <Route path="refills" element={<Guard perm="orders.view"><AdminRefills /></Guard>} />
                <Route path="deposits" element={<Guard perm="deposits.review"><AdminDeposits /></Guard>} />
                <Route path="payments" element={<Guard perm="payments.manage"><AdminPayments /></Guard>} />
                <Route path="providers" element={<Guard perm="providers.manage"><AdminProviders /></Guard>} />
                <Route path="services" element={<Guard perm="services.manage"><AdminServices /></Guard>} />
                <Route path="categories" element={<Guard perm="services.manage"><AdminCategories /></Guard>} />
                <Route path="mappings" element={<Guard perm="services.manage"><AdminMappings /></Guard>} />
                <Route path="reports" element={<Guard perm="reports.view"><AdminReports /></Guard>} />
                <Route path="announcements" element={<Guard perm="announcements.manage"><AdminAnnouncements /></Guard>} />
                <Route path="support-links" element={<Guard perm="support_links.manage"><AdminSupportLinks /></Guard>} />
                <Route path="roles" element={<Guard perm="roles.manage"><AdminRoles /></Guard>} />
                <Route path="settings" element={<Guard perm="settings.manage"><AdminSettings /></Guard>} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <AppRoutes />
            </BrowserRouter>
        </AuthProvider>
    );
}

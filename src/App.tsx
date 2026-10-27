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
    const { profile, loading } = useAuth();
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-bg-base">
                <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }
    if (!profile || (profile as any).role !== 'admin') return <Navigate to="/dashboard" replace />;
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
                <Route path="users" element={<AdminUsers />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="deposits" element={<AdminDeposits />} />
                <Route path="services" element={<AdminServices />} />
                <Route path="payments" element={<AdminPayments />} />
                <Route path="providers" element={<AdminProviders />} />
                <Route path="settings" element={<AdminSettings />} />
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

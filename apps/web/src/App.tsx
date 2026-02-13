import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { ForceChangePasswordPage } from '@/pages/auth/ForceChangePasswordPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ClanPage } from '@/pages/ClanPage';
import { ClanReportPage } from '@/pages/ClanReportPage';
import { SearchPage } from '@/pages/SearchPage';
import { DkpPage } from '@/pages/DkpPage';
import { ActivitiesPage } from '@/pages/ActivitiesPage';
import { AuctionsPage } from '@/pages/AuctionsPage';
import { AuctionDetailPage } from '@/pages/AuctionDetailPage';
import { RandomizerPage } from '@/pages/RandomizerPage';
import { WarehousePage } from '@/pages/WarehousePage';
import { NewsPage } from '@/pages/NewsPage';
import { FeedPage } from '@/pages/FeedPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { UserProfilePage } from '@/pages/UserProfilePage';
import { MessagesPage } from '@/pages/MessagesPage';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage';
import { AdminAuditPage } from '@/pages/admin/AdminAuditPage';
import { AdminSettingsPage } from '@/pages/admin/AdminSettingsPage';
import { DkpRulesPage } from '@/pages/rules/DkpRulesPage';
import { AuctionRulesPage } from '@/pages/rules/AuctionRulesPage';
import { Suspense, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, mustChangePassword } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (mustChangePassword) return <Navigate to="/force-change-password" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin()) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PageLoader() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}

export default function App() {
  const { isAuthenticated, fetchMe, accessToken } = useAuthStore();

  useEffect(() => {
    if (accessToken && isAuthenticated) {
      fetchMe();
    }
  }, [accessToken, isAuthenticated, fetchMe]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={isAuthenticated && !useAuthStore.getState().mustChangePassword ? <Navigate to="/" /> : <LoginPage />} />
        <Route path="/register" element={isAuthenticated ? <Navigate to="/" /> : <RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/force-change-password" element={isAuthenticated ? <ForceChangePasswordPage /> : <Navigate to="/login" />} />
        <Route path="/rules/dkp" element={<DkpRulesPage />} />
        <Route path="/rules/auction" element={<AuctionRulesPage />} />

        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="clan" element={<ClanPage />} />
          <Route path="clan/report" element={<ClanReportPage />} />
          <Route path="dkp" element={<DkpPage />} />
          <Route path="activities" element={<ActivitiesPage />} />
          <Route path="auctions" element={<AuctionsPage />} />
          <Route path="auctions/:id" element={<AuctionDetailPage />} />
          <Route path="randomizer" element={<RandomizerPage />} />
          <Route path="warehouse" element={<WarehousePage />} />
          <Route path="news" element={<NewsPage />} />
          <Route path="feed" element={<FeedPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="users/:id" element={<UserProfilePage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="messages/:userId" element={<MessagesPage />} />

          <Route path="admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
          <Route path="admin/audit" element={<AdminRoute><AdminAuditPage /></AdminRoute>} />
          <Route path="admin/settings" element={<AdminRoute><AdminSettingsPage /></AdminRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

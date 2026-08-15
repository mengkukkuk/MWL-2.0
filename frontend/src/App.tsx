import { lazy, Suspense } from 'react';
import { Center, Loader } from '@mantine/core';
import { AuthProvider } from './auth/AuthProvider';
import { RequireAuth, RequireElevated } from './auth/RequireAuth';
import { AppShellLayout } from './components/AppShellLayout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { Navigate, Route, Routes } from 'react-router';
import { WorkspaceProvider } from './workspace/WorkspaceContext';

const AllowancePage = lazy(() => import('./pages/AllowancePage').then(({ AllowancePage: page }) => ({ default: page })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(({ DashboardPage: page }) => ({ default: page })));
const FileSharePage = lazy(() => import('./pages/FileSharePage').then(({ FileSharePage: page }) => ({ default: page })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(({ SettingsPage: page }) => ({ default: page })));
const SummaryPage = lazy(() => import('./pages/SummaryPage').then(({ SummaryPage: page }) => ({ default: page })));
const WorklogPage = lazy(() => import('./pages/WorklogPage').then(({ WorklogPage: page }) => ({ default: page })));

function PageLoader() {
  return <Center mih="50vh"><Loader color="indigo" /></Center>;
}

export function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<WorkspaceProvider><AppShellLayout /></WorkspaceProvider>}>
              <Route index element={<DashboardPage />} />
              <Route path="worklog" element={<WorklogPage />} />
              <Route path="allowance" element={<AllowancePage />} />
              <Route path="summary" element={<SummaryPage />} />
              <Route path="files" element={<FileSharePage />} />
              <Route element={<RequireElevated />}>
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

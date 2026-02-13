import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth.store.js';
import { useThemeStore } from './stores/theme.store.js';
import { fetchHostConfig } from './api/config.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { AppPage } from './pages/AppPage.js';
import { InvitePage } from './pages/InvitePage.js';
import { VerifyEmailPage } from './pages/VerifyEmailPage.js';
import { LoadingSpinner } from './components/shared/LoadingSpinner.js';
import { ErrorBoundary } from './components/shared/ErrorBoundary.js';
import { ToastContainer } from './components/shared/Toast.js';

function AuthGuard({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-th-bg-tertiary">
        <LoadingSpinner size={48} className="text-th-brand" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function RootRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-th-bg-tertiary">
        <LoadingSpinner size={48} className="text-th-brand" />
      </div>
    );
  }

  return <Navigate to={isAuthenticated ? '/channels/@me' : '/login'} replace />;
}

export function App() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const setHostDefault = useThemeStore((s) => s.setHostDefault);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    fetchHostConfig()
      .then((config) => setHostDefault({ theme: config.defaultTheme, mode: config.defaultMode }))
      .catch(() => { /* host config is optional */ });
  }, [setHostDefault]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/invite/:code" element={<InvitePage />} />
          <Route
            path="/channels/:serverId/:channelId?"
            element={
              <AuthGuard>
                <ErrorBoundary>
                  <AppPage />
                </ErrorBoundary>
              </AuthGuard>
            }
          />
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <ToastContainer />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

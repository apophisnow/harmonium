import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth.store.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { AppPage } from './pages/AppPage.js';
import { InvitePage } from './pages/InvitePage.js';
import { LoadingSpinner } from './components/shared/LoadingSpinner.js';
import { ErrorBoundary } from './components/shared/ErrorBoundary.js';
import { ToastContainer } from './components/shared/Toast.js';

function AuthGuard({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#202225]">
        <LoadingSpinner size={48} className="text-[#5865f2]" />
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
      <div className="flex min-h-screen items-center justify-center bg-[#202225]">
        <LoadingSpinner size={48} className="text-[#5865f2]" />
      </div>
    );
  }

  return <Navigate to={isAuthenticated ? '/channels/@me' : '/login'} replace />;
}

export function App() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
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

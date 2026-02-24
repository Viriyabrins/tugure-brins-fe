import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import PageNotFound from './lib/PageNotFound';
import { KeycloakProvider, useKeycloakAuth } from '@/lib/KeycloakContext';
import { keycloakLogin } from '@/lib/keycloak';

const { Pages, Layout } = pagesConfig;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

/**
 * Route guard: if user is not authenticated or token expired,
 * force redirect to Keycloak login (via "/").
 */
const RequireAuth = ({ children }) => {
  const { isAuthenticated } = useKeycloakAuth();
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated) {
      keycloakLogin({ redirectUri: window.location.href });
    }
  }, [isAuthenticated, location.pathname]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-slate-600">Redirecting to login...</p>
      </div>
    );
  }

  return children;
};

/**
 * For "/" and "/Home": if authenticated → redirect to /Dashboard,
 * otherwise trigger Keycloak login.
 */
const PublicRedirect = () => {
  const { isAuthenticated } = useKeycloakAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      keycloakLogin({ redirectUri: window.location.origin + '/Dashboard' });
    }
  }, [isAuthenticated]);

  if (isAuthenticated) {
    return <Navigate to="/Dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-slate-600">Redirecting to login...</p>
    </div>
  );
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public entry points redirect to Dashboard or Keycloak login */}
      <Route path="/" element={<PublicRedirect />} />
      <Route path="/Home" element={<PublicRedirect />} />

      {/* All other pages require authentication */}
      {Object.entries(Pages)
        .filter(([path]) => path !== 'Home') // Home is handled above
        .map(([path, Page]) => (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <RequireAuth>
                <LayoutWrapper currentPageName={path}>
                  <Page />
                </LayoutWrapper>
              </RequireAuth>
            }
          />
        ))}

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {
  return (
    <KeycloakProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AppRoutes />
        </Router>
        <Toaster />
        <SonnerToaster />
        <VisualEditAgent />
      </QueryClientProvider>
    </KeycloakProvider>
  )
}

export default App

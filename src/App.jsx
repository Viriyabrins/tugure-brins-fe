import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { KeycloakProvider, useKeycloakAuth } from '@/lib/KeycloakContext';
import LandingPage from './pages/LandingPage';
import AdminLayout from './AdminLayout';

const { Pages, Layout } = pagesConfig;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const RequireAuth = ({ children }) => {
  const { isAuthenticated } = useKeycloakAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/Home" replace state={{ from: location }} />;
  }

  return children;
};

const RequireAdmin = ({ children }) => {
  const { isAuthenticated, isSuperAdmin } = useKeycloakAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/Home" replace state={{ from: location }} />;
  }

  if (!isSuperAdmin) {
    return <Navigate to="/Dashboard" replace />;
  }

  return children;
};

const RequireNotAdmin = ({ children }) => {
  const { isSuperAdmin } = useKeycloakAuth();

  if (isSuperAdmin) {
    return <Navigate to="/admin/AdminDashboard" replace />;
  }

  return children;
};

const PublicRedirect = () => {
  const { isAuthenticated, isSuperAdmin } = useKeycloakAuth();

  if (isAuthenticated) {
    // Redirect superadmin to admin dashboard, regular users to normal dashboard
    return <Navigate to={isSuperAdmin ? "/admin/AdminDashboard" : "/Dashboard"} replace />;
  }

  const HomePage = Pages.Home;
  return <HomePage />;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Landing page — shown to everyone, no sidebar/header */}
      <Route path="/" element={<LandingPage />} />

      {/* Login page — show Home or redirect authenticated users */}
      <Route path="/Home" element={<PublicRedirect />} />

      {/* Admin-only routes */}
      <Route
        path="/admin/AdminDashboard"
        element={
          <RequireAdmin>
            <AdminLayout currentPageName="AdminDashboard">
              <Pages.AdminDashboard />
            </AdminLayout>
          </RequireAdmin>
        }
      />

      {/* Regular user routes — protected from superadmin access */}
      {Object.entries(Pages)
        .filter(([path]) => path !== 'Home' && path !== 'AdminDashboard')
        .map(([path, Page]) => (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <RequireAuth>
                <RequireNotAdmin>
                  <LayoutWrapper currentPageName={path}>
                    <Page />
                  </LayoutWrapper>
                </RequireNotAdmin>
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

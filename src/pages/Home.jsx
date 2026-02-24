import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated, keycloakLogin } from '@/lib/keycloak';

/**
 * Home page – acts purely as a redirect gate.
 * If the user is already authenticated → go to /Dashboard.
 * Otherwise → trigger Keycloak login (redirects to cred.sibernetik.co.id).
 */
export default function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/Dashboard', { replace: true });
    } else {
      keycloakLogin();
    }
  }, [navigate]);

  // Brief loading state while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-white">Redirecting...</p>
      </div>
    </div>
  );
}
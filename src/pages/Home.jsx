import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, ArrowRight, AlertCircle, Loader2, Eye, EyeOff, User, Lock } from "lucide-react";
import brinsLogo from '@/assets/brins.png';
import { PortalHeader, PortalFooter } from '@/components/common/PortalChrome';
import tugureLogo from '@/assets/tugure-logo.png';
import { isAuthenticated, ingestDirectLoginTokens } from '@/lib/keycloak';
import { withSignatureHeaders } from '@/lib/requestSignature';

const SUPPORTED_DOMAINS = ['brins.co.id', 'tugu-re.com', 'ibsrisk.com'];

export default function Home() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      if (isAuthenticated()) {
        window.location.href = createPageUrl('Dashboard');
      } else {
        setLoading(false);
      }
    } catch (error) {
      setLoading(false);
    }
  };

  const validateEmail = (email) => {
    const domain = email.toLowerCase().trim().split('@')[1];
    if (!domain) return 'Please enter a valid email address';
    // Domain validation disabled for testing
    // if (!SUPPORTED_DOMAINS.includes(domain)) {
    //   return `Unsupported email domain. Please use ${SUPPORTED_DOMAINS.join(' or ')}`;
    // }
    return null;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    const emailValidation = validateEmail(email);
    if (emailValidation) {
      setError(emailValidation);
      return;
    }

    setLoggingIn(true);

    try {
      const appId = import.meta.env.VITE_APP_ID || 'brin-app-dev';
      const endpoint = `/api/apps/${appId}/auth/login`;
      const fetchOpts = await withSignatureHeaders({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      }, endpoint);
      const response = await fetch(endpoint, fetchOpts);

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        setError(result.message || 'Login failed. Please check your credentials.');
        setLoggingIn(false);
        return;
      }

      const tokenData = result.data;
      ingestDirectLoginTokens({
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        idToken: tokenData.id_token,
      });

      window.location.href = createPageUrl('Dashboard');
    } catch (error) {
      console.error('Login error:', error);
      setError('Login failed. Please try again.');
      setLoggingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full relative overflow-hidden flex flex-col" style={{ background: "linear-gradient(135deg, #0a1f6e 0%, #1a4bbd 40%, #2563eb 70%, #3b82f6 100%)" }}>
      {/* Decorative circles */}
      <div className="absolute top-[-120px] right-[-120px] w-[400px] h-[400px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #60a5fa, transparent)" }} />
      <div className="absolute bottom-[80px] left-[-80px] w-[300px] h-[300px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #93c5fd, transparent)" }} />

      <PortalHeader />

      <main className="flex-1 flex items-center justify-center">
      <div className="w-full max-w-md z-10 p-4">
        <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.15)" }}>
          <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="absolute top-3 left-3 z-30 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/90">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b)" }} />

          <div className="p-8">
            {/* Logos */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="bg-white rounded-xl px-4 py-3 flex items-center gap-2 shadow-md">
                <img src={brinsLogo} alt="BRINS" className="w-8 h-8 object-contain" />
                <div>
                  <p className="text-xs leading-none" style={{ color: "#003087", fontWeight: 700 }}>BRINS</p>
                  <p className="text-xs leading-none" style={{ color: "#003087", fontWeight: 500 }}>Insurance</p>
                </div>
              </div>

              <span className="text-blue-200 text-lg">&amp;</span>

              <div className="bg-white rounded-xl px-4 py-3 flex items-center gap-2 shadow-md">
                <img src={tugureLogo} alt="Tugure" className="w-8 h-8 object-contain" />
                <span className="text-sm" style={{ color: "#1a3a6e", fontWeight: 700, letterSpacing: "0.08em" }}>TUGURE</span>
              </div>
            </div>

            {/* Titles */}
            <div className="text-center mb-7">
              <p className="text-xs text-blue-200 tracking-[0.2em] uppercase mb-1">Credit Reinsurance Platform</p>
              <h1 className="text-white tracking-wide" style={{ fontSize: "1.3rem", fontWeight: 600 }}>BRINS – TUGURE System</h1>
              <p className="text-blue-200 mt-1" style={{ fontSize: "0.78rem" }}>A secure, reliable, and trusted digital reinsurance management platform.</p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                  <label className="block text-xs text-blue-200 mb-1.5 tracking-wide uppercase">Email</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300" />
                  <input
                    type="email"
                    value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-white placeholder-blue-300 text-sm outline-none transition-all duration-200"
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
                    onFocus={(e) => { e.target.style.border = '1px solid rgba(255,255,255,0.5)'; e.target.style.background = 'rgba(255,255,255,0.15)'; }}
                    onBlur={(e) => { e.target.style.border = '1px solid rgba(255,255,255,0.2)'; e.target.style.background = 'rgba(255,255,255,0.1)'; }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-blue-200 mb-1.5 tracking-wide uppercase">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-11 py-3 rounded-xl text-white placeholder-blue-300 text-sm outline-none transition-all duration-200"
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
                    onFocus={(e) => { e.target.style.border = '1px solid rgba(255,255,255,0.5)'; e.target.style.background = 'rgba(255,255,255,0.15)'; }}
                    onBlur={(e) => { e.target.style.border = '1px solid rgba(255,255,255,0.2)'; e.target.style.background = 'rgba(255,255,255,0.1)'; }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 hover:text-white transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 mt-2"
                style={{
                  background: loggingIn ? '#d97706' : 'linear-gradient(135deg, #f59e0b, #fbbf24)',
                  color: '#1a1a1a',
                  border: 'none',
                  boxShadow: '0 4px 15px rgba(245,158,11,0.4)',
                  cursor: loggingIn ? 'not-allowed' : 'pointer',
                }}
              >
                {loggingIn ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </>
                ) : (
                  <>
                    <User className="w-4 h-4" />
                    Submit
                  </>
                )}
              </button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <span className="text-xs text-blue-300">secure access</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
            </div>

            <div className="flex items-center justify-center gap-3 flex-wrap">
              {[{ icon: '🔒', label: 'Security Assured' }, { icon: '⚡', label: 'Fast Access' }, { icon: '📊', label: 'Real-time Reports' }].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-blue-200" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <span className="text-xs">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-blue-300 mt-4 opacity-70">Your session is protected with end-to-end encryption.</p>
      </div>
      </main>

      <PortalFooter />
    </div>
  );
}
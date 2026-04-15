import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { isAuthenticated, ingestDirectLoginTokens } from '@/lib/keycloak';
import { withSignatureHeaders } from '@/lib/requestSignature';

const SUPPORTED_DOMAINS = ['brins.co.id', 'tugure.co.id'];

export default function Home() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    if (!SUPPORTED_DOMAINS.includes(domain)) {
      return `Unsupported email domain. Please use ${SUPPORTED_DOMAINS.join(' or ')}`;
    }
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
      </div>

      <Card className="w-full max-w-md relative z-10 shadow-2xl border-slate-700/50 bg-white/95 backdrop-blur">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Credit Reinsurance Platform
            </CardTitle>
            <CardDescription className="text-base mt-2">
              BRINS - TUGURE System
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <Button 
              type="submit"
              disabled={loggingIn}
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
            >
              {loggingIn ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <span className="mr-2">Sign In</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-4 flex justify-center">
            <button
              onClick={() => navigate('/')}
              aria-label="Kembali ke Landing Page"
              className="text-sm text-black/90 bg-transparent border border-white/20 px-3 py-2 rounded-md hover:text-slate-700"
            >
              Kembali ke Landing Page
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
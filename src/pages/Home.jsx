import React, { useState, useEffect } from 'react';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { base44 } from '@/api/base44Client';

// Demo users for prototype
const DEMO_USERS = {
  'admin@sample.com': { password: 'admin', role: 'admin', full_name: 'Admin User' },
  'brins@sample.com': { password: 'brins', role: 'BRINS', full_name: 'BRINS User' },
  'tugure@sample.com': { password: 'tugure', role: 'TUGURE', full_name: 'TUGURE User' }
};

export default function Home() {
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
      // Check for demo user in localStorage
      const demoUserStr = localStorage.getItem('demo_user');
      if (demoUserStr) {
        // Already logged in, redirect to Dashboard
        window.location.href = createPageUrl('Dashboard');
      } else {
        setLoading(false);
      }
    } catch (error) {
      // Not logged in
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoggingIn(true);

    try {
      // Check demo credentials
      const demoUser = DEMO_USERS[email.toLowerCase()];
      
      if (!demoUser || demoUser.password !== password) {
        setError('Invalid email or password');
        setLoggingIn(false);
        return;
      }

      // Store in localStorage for demo purposes
      localStorage.setItem('demo_user', JSON.stringify({
        email: email.toLowerCase(),
        full_name: demoUser.full_name,
        role: demoUser.role,
        id: Date.now().toString()
      }));

      // Redirect to Dashboard
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

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 font-medium mb-2">Demo Accounts:</p>
            <ul className="text-xs text-blue-700 space-y-1">
              <li><strong>Admin:</strong> admin@sample.com / admin</li>
              <li><strong>BRINS:</strong> brins@sample.com / brins</li>
              <li><strong>TUGURE:</strong> tugure@sample.com / tugure</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
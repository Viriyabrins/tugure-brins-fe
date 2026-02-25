import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  User, Mail, Shield, Building2, Calendar, 
  Lock, CheckCircle2, AlertCircle, LogOut
} from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { useKeycloakAuth } from '@/lib/KeycloakContext';

export default function Profile() {
  const { user, logout, tokenParsed } = useKeycloakAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [changing, setChanging] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters');
      return;
    }

    setChanging(true);
    
    // Simulate password change
    setTimeout(() => {
      setSuccessMessage('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setChanging(false);
    }, 1000);
  };

  // Role info keyed by normalized token role names (upper-case)
  const roleInfo = {
    ADMIN: { label: 'Administrator', color: 'bg-purple-100 text-purple-700 border-purple-200', access: 'Full Access' },
    BRINS: { label: 'BRINS User', color: 'bg-blue-100 text-blue-700 border-blue-200', access: 'BRINS Operations' },
    TUGURE: { label: 'TUGURE User', color: 'bg-green-100 text-green-700 border-green-200', access: 'TUGURE Review' },
    USER: { label: 'User', color: 'bg-blue-100 text-blue-700 border-blue-200', access: 'Standard Access' }
  };

  // Extract ONLY application roles for this app client from Keycloak token:
  // prefer resource_access['brins-tugure'].roles, fallback to resource_access[azp].roles
  const extractTokenRoles = () => {
    const resourceAccess = tokenParsed?.resource_access;
    const azpClientId = tokenParsed?.azp;

    if (!resourceAccess || typeof resourceAccess !== 'object') {
      return [];
    }

    if (Array.isArray(resourceAccess?.['brins-tugure']?.roles)) {
      return resourceAccess['brins-tugure'].roles.map((r) => String(r));
    }

    if (azpClientId && Array.isArray(resourceAccess?.[azpClientId]?.roles)) {
      return resourceAccess[azpClientId].roles.map((r) => String(r));
    }

    return [];
  };

  const tokenRoles = extractTokenRoles();

  // Map token roles to normalized keys for lookups, and pick a display role
  const deriveRoleKey = () => {
    const upper = tokenRoles.map((r) => r.toUpperCase());
    if (upper.includes('ADMIN') || upper.some((r) => r.includes('ADMIN'))) return 'ADMIN';
    if (upper.includes('BRINS') || upper.some((r) => r.includes('BRINS'))) return 'BRINS';
    if (upper.includes('TUGURE') || upper.some((r) => r.includes('TUGURE'))) return 'TUGURE';
    const single = user?.role ? String(user.role).toUpperCase() : null;
    if (single && Object.prototype.hasOwnProperty.call(roleInfo, single)) return single;
    return 'USER';
  };

  const currentRoleKey = deriveRoleKey();
  const currentRoleInfo = roleInfo[currentRoleKey] || roleInfo.USER;

  // Show raw token roles in UI (no mapping), fallback only when token has no roles
  const displayRole = tokenRoles.length > 0 ? tokenRoles.join(', ') : (user?.role || '-');

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Profile"
        subtitle="Manage your account settings and security"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Profile' }
        ]}
      />

      {successMessage && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{successMessage}</AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Information */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">Full Name</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">{user?.full_name}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-gray-500">Email Address</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">{user?.email}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-gray-500">Role</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <Shield className="w-4 h-4 text-gray-400" />
                    <Badge variant="outline" className={currentRoleInfo.color}>
                      {displayRole}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-gray-500">Access Level</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">{currentRoleInfo.access}</span>
                  </div>
                </div>
                {/* <div>
                  <Label className="text-gray-500">Last Login</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">
                      {user?.last_login ? format(new Date(user.last_login), 'MMM d, yyyy HH:mm') : 'N/A'}
                    </span>
                  </div>
                </div> */}
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Security Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <Label htmlFor="current">Current Password</Label>
                  <Input
                    id="current"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>
                <Separator />
                <div>
                  <Label htmlFor="new">New Password</Label>
                  <Input
                    id="new"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>
                <div>
                  <Label htmlFor="confirm">Confirm New Password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={changing || !currentPassword || !newPassword || !confirmPassword}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {changing ? 'Changing...' : 'Change Password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Session Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="w-5 h-5" />
                Session Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-gray-500 text-xs">Active Session</Label>
                <div className="mt-2 p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm font-medium text-green-700">Active Now</span>
                  </div>
                  <p className="text-xs text-green-600 mt-1">Current session</p>
                </div>
              </div>

              {/* <div>
                <Label className="text-gray-500 text-xs">Last Login IP</Label>
                <p className="text-sm font-medium mt-1">192.168.1.100</p>
              </div> */}

              <div className="mt-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => console.log('Keycloak tokenParsed:', tokenParsed)}
                >
                  Show Keycloak tokenParsed (dev)
                </Button>
              </div>

              {/* <Separator /> */}

              {/* <Button 
                variant="outline" 
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleLogoutAll}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout All Sessions
              </Button> */}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Status</span>
                <Badge className="bg-green-100 text-green-700">Active</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Member Since</span>
                <span className="text-sm font-medium">Jan 2025</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
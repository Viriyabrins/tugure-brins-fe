import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
    User,
    Mail,
    Shield,
    Building2,
    Lock,
    CheckCircle2,
    AlertCircle,
} from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { useProfileData } from "../hooks/useProfileData";

export default function Profile() {
    const {
        user,
        tokenParsed,
        currentRoleInfo,
        displayRole,
        currentPassword,
        setCurrentPassword,
        newPassword,
        setNewPassword,
        confirmPassword,
        setConfirmPassword,
        successMessage,
        errorMessage,
        fieldErrors,
        clearFieldError,
        changing,
        handleChangePassword,
    } = useProfileData();

    return (
        <div className="space-y-6">
            <PageHeader
                title="User Profile"
                subtitle="Manage your account settings and security"
                breadcrumbs={[
                    { label: "Dashboard", url: "Dashboard" },
                    { label: "Profile" },
                ]}
            />

            {successMessage && (
                <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700">
                        {successMessage}
                    </AlertDescription>
                </Alert>
            )}

            {errorMessage && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Profile Information + Security */}
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
                                        <Badge
                                            variant="outline"
                                            className={currentRoleInfo.color}
                                        >
                                            {displayRole}
                                        </Badge>
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-gray-500">Access Level</Label>
                                    <div className="flex items-center gap-3 mt-2">
                                        <Building2 className="w-4 h-4 text-gray-400" />
                                        <span className="font-medium">
                                            {currentRoleInfo.access}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Lock className="w-5 h-5" />
                                Security Settings
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form
                                onSubmit={handleChangePassword}
                                className="space-y-4"
                            >
                                <div>
                                    <Label htmlFor="current">Current Password</Label>
                                    <Input
                                        id="current"
                                        type="password"
                                        value={currentPassword}
                                        onChange={(e) => {
                                            setCurrentPassword(e.target.value);
                                            clearFieldError("currentPassword");
                                        }}
                                        placeholder="Enter current password"
                                        className={
                                            fieldErrors.currentPassword
                                                ? "border-red-500 focus-visible:ring-red-500"
                                                : ""
                                        }
                                    />
                                    {fieldErrors.currentPassword && (
                                        <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {fieldErrors.currentPassword}
                                        </p>
                                    )}
                                </div>
                                <Separator />
                                <div>
                                    <Label htmlFor="new">New Password</Label>
                                    <Input
                                        id="new"
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => {
                                            setNewPassword(e.target.value);
                                            clearFieldError("newPassword");
                                        }}
                                        placeholder="Enter new password"
                                        className={
                                            fieldErrors.newPassword
                                                ? "border-red-500 focus-visible:ring-red-500"
                                                : ""
                                        }
                                    />
                                    {fieldErrors.newPassword && (
                                        <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {fieldErrors.newPassword}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="confirm">Confirm New Password</Label>
                                    <Input
                                        id="confirm"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => {
                                            setConfirmPassword(e.target.value);
                                            clearFieldError("confirmPassword");
                                        }}
                                        placeholder="Confirm new password"
                                        className={
                                            fieldErrors.confirmPassword
                                                ? "border-red-500 focus-visible:ring-red-500"
                                                : ""
                                        }
                                    />
                                    {fieldErrors.confirmPassword && (
                                        <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {fieldErrors.confirmPassword}
                                        </p>
                                    )}
                                </div>
                                <Button
                                    type="submit"
                                    disabled={
                                        changing ||
                                        !currentPassword ||
                                        !newPassword ||
                                        !confirmPassword
                                    }
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    {changing ? "Changing..." : "Change Password"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* Session Info + Account Stats */}
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
                                <Label className="text-gray-500 text-xs">
                                    Active Session
                                </Label>
                                <div className="mt-2 p-3 bg-green-50 rounded-lg border border-green-200">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500" />
                                        <span className="text-sm font-medium text-green-700">
                                            Active Now
                                        </span>
                                    </div>
                                    <p className="text-xs text-green-600 mt-1">
                                        Current session
                                    </p>
                                </div>
                            </div>
                            <div className="mt-3">
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() =>
                                        console.log(
                                            "Keycloak tokenParsed:",
                                            tokenParsed,
                                        )
                                    }
                                >
                                    Show Keycloak tokenParsed (dev)
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">
                                Account Stats
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <span className="text-sm text-gray-600">Status</span>
                                <Badge className="bg-green-100 text-green-700">
                                    Active
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <span className="text-sm text-gray-600">
                                    Member Since
                                </span>
                                <span className="text-sm font-medium">Jan 2025</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

import { useState } from "react";
import { useKeycloakAuth } from "@/lib/KeycloakContext";
import {
    ROLE_INFO,
    extractTokenRoles,
    deriveRoleKey,
    validatePasswordForm,
} from "../utils/profileConstants";
import { changePassword as changePasswordApi } from "../services/profileService";

export function useProfileData() {
    const { user, logout, tokenParsed } = useKeycloakAuth();

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [changing, setChanging] = useState(false);

    const tokenRoles = extractTokenRoles(tokenParsed);
    const currentRoleKey = deriveRoleKey(tokenRoles, user?.role);
    const currentRoleInfo = ROLE_INFO[currentRoleKey] || ROLE_INFO.USER;
    const displayRole =
        tokenRoles.length > 0 ? tokenRoles.join(", ") : user?.role || "-";

    const clearFieldError = (field) => {
        if (fieldErrors[field]) {
            setFieldErrors((prev) => ({ ...prev, [field]: "" }));
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setSuccessMessage("");
        setErrorMessage("");
        setFieldErrors({});

        const errors = validatePasswordForm(
            currentPassword,
            newPassword,
            confirmPassword,
        );
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }

        setChanging(true);
        try {
            await changePasswordApi(currentPassword, newPassword);
            setSuccessMessage("Password changed successfully");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err) {
            const msg = err.message || "An unexpected error occurred.";
            if (msg.toLowerCase().includes("current password is incorrect")) {
                setFieldErrors({
                    currentPassword:
                        "Current password is incorrect. Please check and try again.",
                });
            } else {
                setErrorMessage(msg);
            }
        } finally {
            setChanging(false);
        }
    };

    return {
        user,
        logout,
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
    };
}

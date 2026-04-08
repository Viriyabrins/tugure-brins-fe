export const ROLE_INFO = {
    ADMIN: {
        label: "Administrator",
        color: "bg-purple-100 text-purple-700 border-purple-200",
        access: "Full Access",
    },
    BRINS: {
        label: "BRINS User",
        color: "bg-blue-100 text-blue-700 border-blue-200",
        access: "BRINS Operations",
    },
    TUGURE: {
        label: "TUGURE User",
        color: "bg-green-100 text-green-700 border-green-200",
        access: "TUGURE Review",
    },
    USER: {
        label: "User",
        color: "bg-blue-100 text-blue-700 border-blue-200",
        access: "Standard Access",
    },
};

/**
 * Extract application roles from a Keycloak tokenParsed object.
 * Prefers resource_access['brins-tugure'].roles, falls back to resource_access[azp].roles.
 */
export function extractTokenRoles(tokenParsed) {
    const resourceAccess = tokenParsed?.resource_access;
    const azpClientId = tokenParsed?.azp;

    if (!resourceAccess || typeof resourceAccess !== "object") return [];

    if (Array.isArray(resourceAccess?.["brins-tugure"]?.roles)) {
        return resourceAccess["brins-tugure"].roles.map((r) => String(r));
    }

    if (azpClientId && Array.isArray(resourceAccess?.[azpClientId]?.roles)) {
        return resourceAccess[azpClientId].roles.map((r) => String(r));
    }

    return [];
}

/**
 * Derive a normalized ROLE_INFO key from token roles or fallback user.role.
 */
export function deriveRoleKey(tokenRoles, userRole) {
    const upper = tokenRoles.map((r) => r.toUpperCase());
    if (upper.includes("ADMIN") || upper.some((r) => r.includes("ADMIN")))
        return "ADMIN";
    if (upper.includes("BRINS") || upper.some((r) => r.includes("BRINS")))
        return "BRINS";
    if (upper.includes("TUGURE") || upper.some((r) => r.includes("TUGURE")))
        return "TUGURE";
    const single = userRole ? String(userRole).toUpperCase() : null;
    if (single && Object.prototype.hasOwnProperty.call(ROLE_INFO, single))
        return single;
    return "USER";
}

/**
 * Validate the password change form fields.
 * Returns an object with field-level error messages (empty object = valid).
 */
export function validatePasswordForm(currentPassword, newPassword, confirmPassword) {
    const errors = {};
    if (!currentPassword) errors.currentPassword = "Current password is required";
    if (!newPassword) {
        errors.newPassword = "New password is required";
    } else if (newPassword.length < 6) {
        errors.newPassword = "New password must be at least 6 characters";
    }
    if (!confirmPassword) {
        errors.confirmPassword = "Please confirm your new password";
    } else if (newPassword && newPassword !== confirmPassword) {
        errors.confirmPassword =
            "New Password and Confirm New Password do not match";
    }
    return errors;
}

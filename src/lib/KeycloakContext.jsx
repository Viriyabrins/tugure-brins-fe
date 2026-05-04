import React, { createContext, useContext, useMemo } from "react";
import {
    isAuthenticated,
    getKeycloakToken,
    getKeycloakUserInfo,
    refreshKeycloakToken,
    hasRole,
    getUserRoles,
} from "@/lib/keycloak";
import keycloakService from "@/services/keycloakService";

const KeycloakContext = createContext(null);

/**
 * Auth provider backed by Keycloak token state with Home.jsx local-session fallback.
 */
export const KeycloakProvider = ({ children }) => {
    const value = useMemo(
        () => ({
            /** true when a Keycloak or Home.jsx session is available */
            get isAuthenticated() {
                return isAuthenticated();
            },

            /** Current access token (string | null) */
            get token() {
                return getKeycloakToken();
            },

            /** Decoded token payload with user info */
            get tokenParsed() {
                return getKeycloakUserInfo();
            },

            /** Convenient user object derived from the token */
            get user() {
                const t = getKeycloakUserInfo();
                if (!t) return null;

                // Derive role: check for known client/realm roles
                const roles = getUserRoles() || [];
                const normalizedRoles = Array.isArray(roles)
                    ? roles.map((r) => String(r || "").trim().toLowerCase())
                    : [];
                let role = "USER";
                if (normalizedRoles.includes("admin")) role = "admin";
                // Prefer TUGURE when both TUGURE and BRINS exist on token
                else if (normalizedRoles.some((r) => r.includes("tugure")))
                    role = "TUGURE";
                else if (normalizedRoles.some((r) => r.includes("brins")))
                    role = "BRINS";

                // Detect superadmin: username "viriya" with "admin" role
                const isSuperAdmin = t.preferred_username === "viriya" && normalizedRoles.includes("admin");

                return {
                    id: t.sub,
                    email: t.email,
                    full_name: t.name,
                    name: t.name,
                    preferredUsername: t.preferred_username,
                    firstName: t.given_name,
                    lastName: t.family_name,
                    role,
                    roles,
                    isSuperAdmin,
                };
            },

            /** Check if user is superadmin (viriya with admin role) */
            get isSuperAdmin() {
                return this.user?.isSuperAdmin || false;
            },

            /** All realm + client roles */
            getRoles: getUserRoles,

            /** Check a single role */
            hasRole,

            /** Trigger logout via service and return to Home */
            logout: () => keycloakService.logout(),

            /** Manually refresh the token */
            refreshToken: refreshKeycloakToken,
        }),
        [],
    );

    return (
        <KeycloakContext.Provider value={value}>
            {children}
        </KeycloakContext.Provider>
    );
};

/**
 * Hook to access the Keycloak auth context.
 * Must be used inside <KeycloakProvider>.
 */
export const useKeycloakAuth = () => {
    const ctx = useContext(KeycloakContext);
    if (!ctx) {
        throw new Error(
            "useKeycloakAuth must be used within a <KeycloakProvider>",
        );
    }
    return ctx;
};

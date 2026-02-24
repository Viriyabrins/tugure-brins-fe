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
 * Lightweight auth provider backed entirely by Keycloak.
 * No localStorage – everything lives in Keycloak's in-memory token.
 */
export const KeycloakProvider = ({ children }) => {
    const value = useMemo(
        () => ({
            /** true when Keycloak has a valid session */
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
                const roles = getUserRoles();
                let role = "USER";
                if (roles.includes("admin") || roles.includes("ADMIN"))
                    role = "admin";
                else if (roles.includes("BRINS") || roles.includes("brins"))
                    role = "BRINS";
                else if (roles.includes("TUGURE") || roles.includes("tugure"))
                    role = "TUGURE";

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
                };
            },

            /** All realm + client roles */
            getRoles: getUserRoles,

            /** Check a single role */
            hasRole,

            /** Trigger Keycloak logout via service (redirects browser) */
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

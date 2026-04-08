import { useState, useEffect } from "react";

const ROLE_PRIORITY = [
    "approver-tugure-role",
    "checker-tugure-role",
    "approver-brins-role",
    "checker-brins-role",
    "maker-brins-role",
];

function deriveRole(normalized) {
    if (normalized.includes("admin")) return "admin";
    return ROLE_PRIORITY.find((r) => normalized.includes(r)) || "USER";
}

/**
 * Loads the current Keycloak user info and roles on mount.
 * Provides `user`, `userRoles`, and a `hasAnyRole()` helper.
 *
 * Usage:
 *   const { user, userRoles, hasAnyRole } = useCurrentUser();
 *   if (hasAnyRole('maker-brins-role', 'checker-brins-role')) { ... }
 */
export function useCurrentUser() {
    const [user, setUser] = useState(null);
    const [userRoles, setUserRoles] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                const { default: keycloakService } = await import(
                    "@/services/keycloakService"
                );
                const userInfo = keycloakService.getCurrentUserInfo();
                if (!userInfo) return;

                const roles = keycloakService.getRoles();
                const roleList = Array.isArray(roles) ? roles : [];
                const normalized = roleList
                    .map((r) => String(r || "").trim().toLowerCase())
                    .filter(Boolean);

                setUserRoles(roleList);
                setUser({
                    id: userInfo.id,
                    email: userInfo.email,
                    full_name: userInfo.name,
                    role: deriveRole(normalized),
                });
            } catch (error) {
                console.error("Failed to load user:", error);
            }
        })();
    }, []);

    const hasAnyRole = (...allowedRoles) =>
        userRoles.some((r) =>
            allowedRoles.includes(String(r || "").trim().toLowerCase()),
        );

    return { user, userRoles, hasAnyRole };
}

import { getKeycloakRoles } from "@/lib/keycloak";

/**
 * Derives tenant identity from Keycloak roles.
 * Returns isTugureUser, isBrinsUser, and the raw/normalized role arrays.
 *
 * Usage:
 *   const { isBrinsUser, isTugureUser } = useUserTenant();
 */
export function useUserTenant() {
    const roles = getKeycloakRoles() || [];
    const normalized = roles.map((r) => String(r || "").trim().toLowerCase());
    const isTugureUser = normalized.some((r) => r.includes("tugure"));
    const isBrinsUser = !isTugureUser && normalized.some((r) => r.includes("brins"));
    return { isTugureUser, isBrinsUser, roles, normalized };
}

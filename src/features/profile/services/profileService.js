import { getKeycloakToken } from "@/lib/keycloak";

/**
 * Send a change-password request to the backend Keycloak proxy.
 * Returns { success, message } from the response body.
 */
export async function changePassword(currentPassword, newPassword) {
    const token = getKeycloakToken();
    const response = await fetch("/api/auth/keycloak/change-password", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
        const msg = data.message || "Failed to change password";
        throw new Error(msg);
    }

    return data;
}

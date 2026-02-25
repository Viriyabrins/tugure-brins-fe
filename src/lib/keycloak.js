const keycloakConfig = {
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'brins-tugure',
    redirectUri: import.meta.env.VITE_KEYCLOAK_REDIRECT_URI || 'http://localhost:5173/Dashboard',
};

const apiBase = '';

const authState = {
    authenticated: false,
    token: null,
    refreshToken: null,
    idToken: null,
    tokenParsed: null,
};

const decodeJwtPayload = (jwt) => {
    if (!jwt || typeof jwt !== 'string') return null;
    const parts = jwt.split('.');
    if (parts.length < 2) return null;
    try {
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
        return JSON.parse(atob(base64 + pad));
    } catch {
        return null;
    }
};

const setTokens = ({ accessToken, refreshToken, idToken }) => {
    authState.token = accessToken || null;
    authState.refreshToken = refreshToken || null;
    authState.idToken = idToken || null;
    authState.tokenParsed = decodeJwtPayload(accessToken);
    authState.authenticated = Boolean(accessToken);
};

const clearTokens = () => {
    authState.token = null;
    authState.refreshToken = null;
    authState.idToken = null;
    authState.tokenParsed = null;
    authState.authenticated = false;
};

// Auto-refresh token interval (every 30 seconds)
let _tokenRefreshInterval = null;

function cleanupAuthParamsFromUrl() {
    try {
        const currentUrl = new URL(window.location.href);

        // Remove OIDC callback params from query
        ['code', 'state', 'session_state', 'iss'].forEach((param) => {
            currentUrl.searchParams.delete(param);
        });

        // Remove callback params from hash
        if (currentUrl.hash) {
            const hash = currentUrl.hash.replace(/^#/, '');
            const hashParams = new URLSearchParams(hash);
            [
                'code',
                'state',
                'session_state',
                'iss',
                'kc_access_token',
                'kc_refresh_token',
                'kc_id_token',
                'kc_expires_in',
                'kc_token_type',
                'kc_email',
                'kc_name',
                'kc_sub',
            ].forEach((param) => {
                hashParams.delete(param);
            });
            const nextHash = hashParams.toString();
            currentUrl.hash = nextHash ? `#${nextHash}` : '';
        }

        window.history.replaceState({}, document.title, currentUrl.toString());
    } catch (error) {
        console.warn('Failed to cleanup auth params from URL:', error);
    }
}

function startTokenRefresh() {
    if (_tokenRefreshInterval) clearInterval(_tokenRefreshInterval);
    _tokenRefreshInterval = setInterval(async () => {
        if (!authState.authenticated || !authState.tokenParsed?.exp) return;

        const expiresIn = authState.tokenParsed.exp - Math.floor(Date.now() / 1000);
        if (expiresIn > 60) return;

        try {
            await refreshKeycloakToken();
        } catch (err) {
            console.error('Auto token refresh failed:', err);
            keycloakLogout();
        }
    }, 30000); // run every 30s
}

function ingestTokensFromHash() {
    if (!window.location.hash) return false;
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);

    const accessToken = params.get('kc_access_token');
    const refreshToken = params.get('kc_refresh_token');
    const idToken = params.get('kc_id_token');

    if (!accessToken) return false;

    setTokens({ accessToken, refreshToken, idToken });
    cleanupAuthParamsFromUrl();
    return true;
}

// Keycloak Initialization Function
export async function initKeycloak() {
    try {
        const authenticatedFromCallback = ingestTokensFromHash();

        if (authenticatedFromCallback) {
            startTokenRefresh();
            return true;
        }

        clearTokens();
        await keycloakLogin({ redirectUri: keycloakConfig.redirectUri });
        return false;
    } catch (error) {
        console.error('Failed to initialize adapter:', error);
        throw error;
    }
}

// Keycloak Login Function
export async function keycloakLogin(options = {}) {
    const redirectUri = options.redirectUri || keycloakConfig.redirectUri;
    const loginUrl = `${apiBase}/api/auth/keycloak/login?redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = loginUrl;
}

// Keycloak Logout Function
export async function keycloakLogout(options = {}) {
    const redirectUri = options.redirectUri || `${window.location.origin}/`;

    if (_tokenRefreshInterval) {
        clearInterval(_tokenRefreshInterval);
        _tokenRefreshInterval = null;
    }

    try {
        await fetch(`${apiBase}/api/auth/keycloak/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                refreshToken: authState.refreshToken,
                idToken: authState.idToken,
                redirectUri,
            }),
        });
    } catch (error) {
        console.error('Keycloak logout request failed:', error);
    }

    clearTokens();
    window.location.href = redirectUri;
}

// Check if the user is authenticated
export function isAuthenticated() {
    return !!authState.authenticated;
}

// Alias used by keycloakService
export const isKeycloakAuthenticated = isAuthenticated;

// Get the Keycloak token
export function getKeycloakToken() {
    return authState.token;
}

// Get the Keycloak user info
export function getKeycloakUserInfo() {
    return authState.tokenParsed;
}

// Refresh the Keycloak token
export async function refreshKeycloakToken() {
    try {
        if (!authState.refreshToken) {
            throw new Error('No refresh token available');
        }

        const response = await fetch(`${apiBase}/api/auth/keycloak/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: authState.refreshToken }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.success || !payload?.data?.accessToken) {
            throw new Error(payload?.message || 'Failed to refresh token');
        }

        setTokens({
            accessToken: payload.data.accessToken,
            refreshToken: payload.data.refreshToken,
            idToken: payload.data.idToken,
        });
        return authState.token;
    } catch (error) {
        console.error('Failed to refresh token:', error);
        keycloakLogout(); // Force logout 
        throw error;
    }
}

// Check if the user has a specific role
export function hasRole(role) {
    const roles = getUserRoles();
    return roles.includes(role);
}

// Alias used by keycloakService
export const hasKeycloakRole = hasRole;

// Get user roles
export function getUserRoles() {
    const token = authState.tokenParsed || {};
    const realmRoles = token.realm_access?.roles || [];
    const clientRoles = token.resource_access?.[keycloakConfig.clientId]?.roles || [];

    return [...realmRoles, ...clientRoles];
}

// Alias used by keycloakService
export const getKeycloakRoles = getUserRoles;

const keycloak = {
    get authenticated() {
        return authState.authenticated;
    },
    get token() {
        return authState.token;
    },
    get tokenParsed() {
        return authState.tokenParsed;
    },
};

export default keycloak;
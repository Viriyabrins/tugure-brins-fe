import Keycloak from 'keycloak-js';

const keycloakConfig = {
    url: import.meta.env.VITE_KEYCLOAK_URL || 'https://cred.sibernetik.co.id',
    realm: import.meta.env.VITE_KEYCLOAK_REALM || 'insurance',
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'brins-tugure',
    redirectUri: import.meta.env.VITE_KEYCLOAK_REDIRECT_URI || 'http://localhost:5173/Dashboard'
};

const keycloak = new Keycloak(keycloakConfig);

// Auto-refresh token interval (every 30 seconds)
let _tokenRefreshInterval = null;

function cleanupAuthParamsFromUrl() {
    try {
        const currentUrl = new URL(window.location.href);

        // Remove OIDC callback params from query
        ['code', 'state', 'session_state', 'iss'].forEach((param) => {
            currentUrl.searchParams.delete(param);
        });

        // Remove OIDC callback params from hash (if responseMode=fragment appears)
        if (currentUrl.hash) {
            const hash = currentUrl.hash.replace(/^#/, '');
            const hashParams = new URLSearchParams(hash);
            ['code', 'state', 'session_state', 'iss'].forEach((param) => {
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
        if (keycloak.authenticated) {
            try {
                await keycloak.updateToken(60); // refresh if expires within 60s
            } catch (err) {
                console.error('Auto token refresh failed:', err);
                keycloakLogout();
            }
        }
    }, 30000); // run every 30s
}

// Keycloak Initialization Function
export async function initKeycloak() {
    try {
        const authenticated = await keycloak.init({
            onLoad: 'login-required',
            flow: 'standard',
            pkceMethod: 'S256',
            responseMode: 'query',
            checkLoginIframe: false,
            redirectUri: keycloakConfig.redirectUri,
        });

        console.log('Keycloak initialized:', authenticated);

        if (authenticated) {
            cleanupAuthParamsFromUrl();
            startTokenRefresh();
        }

        // Handle token expiry event
        keycloak.onTokenExpired = () => {
            console.warn('Keycloak token expired, attempting refresh...');
            keycloak.updateToken(30).catch(() => {
                console.error('Token refresh after expiry failed, logging out');
                keycloakLogout();
            });
        };

        return authenticated;
    } catch (error) {
        console.error('Failed to initialize adapter:', error);
        throw error;
    }
}

// Keycloak Login Function
export function keycloakLogin() {
    return keycloak.login();
}

// Keycloak Logout Function
export async function keycloakLogout(options = {}) {
    const redirectUri = options.redirectUri || `${window.location.origin}/`;

    if (_tokenRefreshInterval) {
        clearInterval(_tokenRefreshInterval);
        _tokenRefreshInterval = null;
    }

    try {
        await keycloak.logout({ redirectUri: window.location.origin });
    } catch (error) {
        console.error('Keycloak JS logout failed, falling back to local redirect:', error);
        keycloak.clearToken();
        window.location.href = redirectUri;
    }
}

// Check if the user is authenticated
export function isAuthenticated() {
    return !!keycloak.authenticated;
}

// Alias used by keycloakService
export const isKeycloakAuthenticated = isAuthenticated;

// Get the Keycloak token
export function getKeycloakToken() {
    return keycloak.token;
}

// Get the Keycloak user info
export function getKeycloakUserInfo() {
    return keycloak.tokenParsed;
}

// Refresh the Keycloak token
export async function refreshKeycloakToken() {
    try {
        const refreshed = await keycloak.updateToken(30); // Refresh if token will expire in 30 seconds

        if (refreshed) {
            console.log('Token refreshed successfully');
        }

        return keycloak.token;
    } catch (error) {
        console.error('Failed to refresh token:', error);
        keycloakLogout(); // Force logout 
        throw error;
    }
}

// Check if the user has a specific role
export function hasRole(role) {
    return keycloak.hasRealmRole(role) || keycloak.hasResourceRole(role);
}

// Alias used by keycloakService
export const hasKeycloakRole = hasRole;

// Get user roles
export function getUserRoles() {
    const realmRoles = keycloak.realmAccess?.roles || [];
    const clientRoles = keycloak.resourceAccess?.[keycloakConfig.clientId]?.roles || [];

    return [...realmRoles, ...clientRoles];
}

// Alias used by keycloakService
export const getKeycloakRoles = getUserRoles;

export default keycloak;
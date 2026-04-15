/** @typedef {{ id?: string, email?: string, full_name?: string, name?: string, role?: string }} LocalSessionUser */
/** @typedef {{ redirectUri?: string }} RedirectOptions */
/** @typedef {{ accessToken?: string | null, refreshToken?: string | null, idToken?: string | null }} TokenSet */

import { withSignatureHeaders } from './requestSignature';


const keycloakConfig = {
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'brins-tugure',
    redirectUri: import.meta.env.VITE_KEYCLOAK_REDIRECT_URI || 'http://localhost:5173/Dashboard',
};

const apiBase = '';

/** @type {{ authenticated: boolean, token: string | null, refreshToken: string | null, idToken: string | null, tokenParsed: Record<string, any> | null }} */
const authState = {
    authenticated: false,
    token: null,
    refreshToken: null,
    idToken: null,
    tokenParsed: null,
};

const LOCAL_SESSION_KEY = 'demo_user';
const KC_SESSION_TOKENS_KEY = 'kc_session_tokens';

const saveTokensToStorage = (tokens) => {
    try {
        sessionStorage.setItem(KC_SESSION_TOKENS_KEY, JSON.stringify(tokens));
    } catch {
        // ignore storage errors
    }
};

const clearTokensFromStorage = () => {
    try {
        sessionStorage.removeItem(KC_SESSION_TOKENS_KEY);
    } catch {
        // ignore
    }
};

const loadTokensFromStorage = () => {
    try {
        const raw = sessionStorage.getItem(KC_SESSION_TOKENS_KEY);
        if (!raw) return false;
        const tokens = JSON.parse(raw);
        if (!tokens?.accessToken) return false;
        setTokens(tokens);
        return true;
    } catch {
        return false;
    }
};

/** @returns {LocalSessionUser | null} */
const getLocalSessionUser = () => {
    try {
        const rawUser = window.localStorage.getItem(LOCAL_SESSION_KEY);
        if (!rawUser) return null;

        /** @type {unknown} */
        const parsedUser = JSON.parse(rawUser);
        return parsedUser && typeof parsedUser === 'object' ? parsedUser : null;
    } catch {
        return null;
    }
};

/** @param {LocalSessionUser | null} user */
const buildLocalSessionClaims = (user) => {
    if (!user) return null;

    const normalizedRole = String(user.role || 'USER').trim().toLowerCase();
    /** @type {string[]} */
    let access = [];
    /** @type {string[]} */
    let clientRoles = [];
    /** @type {string[]} */
    let realmRoles = [];

    if (normalizedRole === 'admin') {
        access = ['brins operation', 'tugure review'];
        clientRoles = ['admin', 'admin-brins-role'];
        realmRoles = ['admin'];
    } else if (normalizedRole === 'brins') {
        access = ['brins operation'];
        clientRoles = ['maker-brins-role'];
    } else if (normalizedRole === 'tugure') {
        access = ['tugure review'];
        clientRoles = ['checker-tugure-role'];
    } else {
        clientRoles = [String(user.role || 'USER')];
    }

    return {
        sub: user.id || user.email || 'local-user',
        email: user.email || '',
        name: user.full_name || user.name || user.email || 'Local User',
        preferred_username: user.email || '',
        given_name: user.full_name || user.name || '',
        family_name: '',
        access,
        azp: keycloakConfig.clientId,
        realm_access: { roles: realmRoles },
        resource_access: {
            [keycloakConfig.clientId]: { roles: clientRoles },
            'brins-tugure': { roles: clientRoles },
        },
    };
};

/** @param {string | null | undefined} jwt */
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

/** @param {TokenSet} param0 */
const setTokens = ({ accessToken, refreshToken, idToken }) => {
    authState.token = accessToken || null;
    authState.refreshToken = refreshToken || null;
    authState.idToken = idToken || null;
    authState.tokenParsed = decodeJwtPayload(accessToken);
    authState.authenticated = Boolean(accessToken);
    if (accessToken) {
        saveTokensToStorage({ accessToken, refreshToken, idToken });
    }
};

const clearTokens = () => {
    authState.token = null;
    authState.refreshToken = null;
    authState.idToken = null;
    authState.tokenParsed = null;
    authState.authenticated = false;
    clearTokensFromStorage();
};

// Auto-refresh token interval (every 30 seconds)
/** @type {ReturnType<typeof setInterval> | null} */
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
        const tokenParsed = authState.tokenParsed;
        if (!authState.authenticated || !tokenParsed || typeof tokenParsed.exp !== 'number') return;

        const expiresIn = tokenParsed.exp - Math.floor(Date.now() / 1000);
        if (expiresIn > 60) return;

        try {
            console.log('[Keycloak] auto-refresh triggered', {
                expiresIn,
                tokenHint: authState.token ? `${String(authState.token).slice(0,8)}...` : null,
            });
            await refreshKeycloakToken();
        } catch (err) {
            console.error('[Keycloak] Auto token refresh failed:', err);
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

/**
 * Ingest tokens returned directly by the backend login endpoint
 * (Resource Owner Password Credentials flow).
 * Call this from the login page after a successful POST to /api/apps/:appId/auth/login.
 * @param {{ accessToken: string, refreshToken?: string, idToken?: string }} tokens
 */
export function ingestDirectLoginTokens({ accessToken, refreshToken, idToken }) {
    if (!accessToken) return;
    setTokens({ accessToken, refreshToken, idToken });
    startTokenRefresh();
}

// Keycloak Initialization Function
export async function initKeycloak() {
    try {
        if (ingestTokensFromHash()) {
            startTokenRefresh();
            return true;
        }

        if (loadTokensFromStorage()) {
            startTokenRefresh();
            return true;
        }

        clearTokens();
        return Boolean(getLocalSessionUser());
    } catch (error) {
        console.error('Failed to initialize adapter:', error);
        throw error;
    }
}

// Keycloak Login Function — redirects to the app login page.
// Previously called the OIDC broker route (/api/auth/keycloak/login) which
// only supported the brins realm. Direct login on /Home handles all realms.
/** @param {RedirectOptions} [options={}] */
export async function keycloakLogin(options = {}) {
    window.location.href = '/Home';
}

// Keycloak Logout Function
/** @param {RedirectOptions} [options={}] */
export async function keycloakLogout(options = {}) {
    const redirectUri = options.redirectUri || `${window.location.origin}/`;

    if (_tokenRefreshInterval) {
        clearInterval(_tokenRefreshInterval);
        _tokenRefreshInterval = null;
    }

    if (authState.refreshToken || authState.idToken) {
        try {
            const logoutEndpoint = `${apiBase}/api/auth/keycloak/logout`;
            const fetchOpts = await withSignatureHeaders({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    refreshToken: authState.refreshToken,
                    idToken: authState.idToken,
                    redirectUri,
                }),
            }, logoutEndpoint);
            await fetch(logoutEndpoint, fetchOpts);
        } catch (error) {
            console.error('Keycloak logout request failed:', error);
        }
    }

    window.localStorage.removeItem(LOCAL_SESSION_KEY);
    clearTokens();
    window.location.href = redirectUri;
}

// Check if the user is authenticated
export function isAuthenticated() {
    return !!authState.authenticated || Boolean(getLocalSessionUser());
}

// Alias used by keycloakService
export const isKeycloakAuthenticated = isAuthenticated;

// Get the Keycloak token
export function getKeycloakToken() {
    return authState.token;
}

// Get the Keycloak user info
export function getKeycloakUserInfo() {
    return authState.tokenParsed || buildLocalSessionClaims(getLocalSessionUser());
}

// Refresh the Keycloak token
export async function refreshKeycloakToken() {
    try {
        if (!authState.refreshToken) {
            throw new Error('No refresh token available');
        }

        console.log('[Keycloak] refreshKeycloakToken: requesting refresh', {
            refreshTokenHint: authState.refreshToken ? `${String(authState.refreshToken).slice(0,8)}...` : null,
            idTokenHint: authState.idToken ? `${String(authState.idToken).slice(0,8)}...` : null,
            tokenExp: authState.tokenParsed?.exp || null,
        });

        const refreshEndpoint = `${apiBase}/api/auth/keycloak/refresh`;
        const refreshOpts = await withSignatureHeaders({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Send idToken alongside refreshToken so the backend can detect
            // the correct realm even if the refresh token is opaque.
            body: JSON.stringify({
                refreshToken: authState.refreshToken,
                idToken: authState.idToken,
            }),
        }, refreshEndpoint);
        const response = await fetch(refreshEndpoint, refreshOpts);

        const payload = await response.json().catch(() => ({}));
        console.log('[Keycloak] refreshKeycloakToken: refresh response', { status: response.status, ok: response.ok, payload });
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
/** @param {string} role */
export function hasRole(role) {
    const roles = getUserRoles();
    return roles.includes(role);
}

// Alias used by keycloakService
export const hasKeycloakRole = hasRole;

// Get user roles
export function getUserRoles() {
    const token = getKeycloakUserInfo();
    if (!token) return [];

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
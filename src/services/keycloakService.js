import {
    isKeycloakAuthenticated,
    getKeycloakToken,
    getKeycloakUserInfo,
    refreshKeycloakToken,
    keycloakLogin,
    keycloakLogout,
    hasKeycloakRole,
    getKeycloakRoles,
} from '@/lib/keycloak'

class KeycloakService {
    // Check if the user is authenticated
    isAuthenticated() {
        return isKeycloakAuthenticated();
    }

    // Get the Keycloak current token
    getToken() {
        return getKeycloakToken();
    }

    // Get the Keycloak current user info
    getCurrentUserInfo() {
        const tokenInfo = getKeycloakUserInfo();

        if (!tokenInfo) {
            console.warn('No token info available');
            return null;
        } else {
            return {
                id: tokenInfo.sub,
                email: tokenInfo.email,
                name: tokenInfo.name,
                preferredUsername: tokenInfo.preferred_username,
                firstName: tokenInfo.given_name,
                lastName: tokenInfo.family_name,
            }
        }
    }

    // Login the user
    async login() {
        try {
            await keycloakLogin();
        } catch (error) {
            console.error('Error during Keycloak login:', error);
            throw error;
        }
    }

    //logout the user
    async logout() {
        try {
            await keycloakLogout();
        } catch (error) {
            console.error('Error during Keycloak logout:', error);
            throw error;
        }
    }

    //refresh the token
    async refreshToken() {
        try {
            await refreshKeycloakToken();
        } catch (error) {
            console.error('Error refreshing Keycloak token:', error);
            throw error;
        }
    }

    /**
   * Check if user has a specific role
   */
    hasRole(role) {
        return hasKeycloakRole(role)
    }

    /**
     * Get user roles
     */
    getRoles() {
        return getKeycloakRoles()
    }

    /**
     * Check if user has any of the provided roles
     */
    hasAnyRole(roles) {
        return roles.some((role) => this.hasRole(role))
    }

    /**
     * Check if user has all of the provided roles
     */
    hasAllRoles(roles) {
        return roles.every((role) => this.hasRole(role))
    }

    /**
     * Get authorization header
     */
    getAuthorizationHeader() {
        const token = this.getToken()
        return token ? { Authorization: `Bearer ${token}` } : {}
    }

    // Get full user profile including roles
    getUserProfile() {
        const user = this.getCurrentUserInfo()
        if (user) {
            return {
                ...user,
                roles: this.getRoles(),
                authenticated: this.isAuthenticated(),
            }
        }
        return null
    }
}

export default new KeycloakService();
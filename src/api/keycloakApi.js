import axios from 'axios'
import keycloakService from '@/services/keycloakService'

const api = axios.create({
    //baseURL: import.meta.env.VITE_API_BASE_URL || '',
    headers: {
        'Content-Type': 'application/json',
    },
})

// Request interceptor - add token to all requests
api.interceptors.request.use(
    (config) => {
        const token = keycloakService.getToken()
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    (error) => {
        return Promise.reject(error)
    }
)

// Response interceptor - handle 401 and refresh token if needed
api.interceptors.response.use(
    (response) => {
        return response
    },
    async (error) => {
        const originalRequest = error.config

        // Handle 401 errors - token might be expired
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true

            try {
                // Try to refresh token
                await keycloakService.refreshToken()
                const token = keycloakService.getToken()
                originalRequest.headers.Authorization = `Bearer ${token}`

                // Retry the original request
                return api(originalRequest)
            } catch (refreshError) {
                console.error('Token refresh failed, redirecting to login')
                // Redirect to login if refresh fails
                await keycloakService.login()
                return Promise.reject(refreshError)
            }
        }

        return Promise.reject(error)
    }
)

export default api
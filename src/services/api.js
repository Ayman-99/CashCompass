import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // Important for session cookies
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor to add auth token if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Check if session expired
      const isSessionExpired = error.response?.data?.expired === true
      const errorMessage = error.response?.data?.error || 'Session expired'
      
      // Clear auth
      localStorage.removeItem('auth_token')
      
      // Show message if session expired
      if (isSessionExpired) {
        // Store message to show on login page
        sessionStorage.setItem('session_expired', 'true')
        sessionStorage.setItem('session_message', errorMessage || 'Your session has expired after 2 days of inactivity. Please login again.')
      }
      
      // Redirect to login
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api


import { defineStore } from 'pinia'
import { authService } from '../services/authService'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    isAuthenticated: false,
    loading: false,
    error: null
  }),

  actions: {
    async login(username, password) {
      this.loading = true
      this.error = null
      try {
        const response = await authService.webLogin(username, password)
        this.user = response.user
        this.isAuthenticated = true
        return { success: true }
      } catch (error) {
        // Better error handling
        if (error.response) {
          // Server responded with error
          this.error = error.response.data?.error || `Server error: ${error.response.status}`
        } else if (error.request) {
          // Request made but no response (network error)
          this.error = 'Cannot connect to server. Make sure the backend is running on port 9001.'
        } else {
          // Something else happened
          this.error = error.message || 'Login failed'
        }
        console.error('Login error:', error)
        return { success: false, error: this.error }
      } finally {
        this.loading = false
      }
    },

    async apiLogin(username, password) {
      this.loading = true
      this.error = null
      try {
        const response = await authService.apiLogin(username, password)
        if (response.token) {
          localStorage.setItem('auth_token', response.token)
        }
        this.user = response.user
        this.isAuthenticated = true
        return { success: true, token: response.token }
      } catch (error) {
        this.error = error.response?.data?.error || 'Login failed'
        return { success: false, error: this.error }
      } finally {
        this.loading = false
      }
    },

    async logout() {
      try {
        await authService.logout()
      } catch (error) {
        console.error('Logout error:', error)
      } finally {
        this.user = null
        this.isAuthenticated = false
        localStorage.removeItem('auth_token')
      }
    },

    async checkAuth() {
      try {
        const user = await authService.getCurrentUser()
        this.user = user
        this.isAuthenticated = true
        return true
      } catch (error) {
        this.user = null
        this.isAuthenticated = false
        return false
      }
    }
  }
})


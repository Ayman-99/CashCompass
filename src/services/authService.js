import api from './api'

export const authService = {
  async webLogin(username, password) {
    const response = await api.post('/auth/web-login', { username, password })
    return response.data
  },

  async apiLogin(username, password) {
    const response = await api.post('/auth/api-login', { username, password })
    return response.data
  },

  async logout() {
    const response = await api.post('/auth/logout')
    return response.data
  },

  async getCurrentUser() {
    const response = await api.get('/auth/me')
    return response.data
  }
}


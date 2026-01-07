import api from './api'

export const accountService = {
  async getAccounts(convertToILS = false) {
    const params = convertToILS ? { convertToILS: 'true' } : {}
    const response = await api.get('/accounts', { params })
    return response.data
  },

  async getAccount(id) {
    const response = await api.get(`/accounts/${id}`)
    return response.data
  },

  async createAccount(data) {
    const response = await api.post('/accounts', data)
    return response.data
  },

  async updateAccount(id, data) {
    const response = await api.put(`/accounts/${id}`, data)
    return response.data
  },

  async deleteAccount(id) {
    const response = await api.delete(`/accounts/${id}`)
    return response.data
  }
}


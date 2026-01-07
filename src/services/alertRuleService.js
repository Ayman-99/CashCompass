import api from './api'

export const alertRuleService = {
  async getAlertRules() {
    const response = await api.get('/settings/alert-rules')
    return response.data
  },

  async getAlertRule(id) {
    const response = await api.get(`/settings/alert-rules/${id}`)
    return response.data
  },

  async createAlertRule(data) {
    const response = await api.post('/settings/alert-rules', data)
    return response.data
  },

  async updateAlertRule(id, data) {
    const response = await api.put(`/settings/alert-rules/${id}`, data)
    return response.data
  },

  async deleteAlertRule(id) {
    const response = await api.delete(`/settings/alert-rules/${id}`)
    return response.data
  }
}


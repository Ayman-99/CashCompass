import api from './api'

export const settingsService = {
  // Profile
  async updateProfile(data) {
    const response = await api.put('/settings/profile', data)
    return response.data
  },

  async changePassword(oldPassword, newPassword) {
    const response = await api.post('/settings/password', {
      oldPassword,
      newPassword
    })
    return response.data
  },

  // Webhook
  async getWebhook() {
    const response = await api.get('/settings/webhook')
    return response.data
  },

  async saveWebhook(webhookUrl, isEnabled) {
    const response = await api.post('/settings/webhook', {
      webhookUrl,
      isEnabled
    })
    return response.data
  },

  async deleteWebhook() {
    const response = await api.delete('/settings/webhook')
    return response.data
  },

  async testWebhook() {
    const response = await api.post('/settings/webhook/test')
    return response.data
  },

  async getBudgetStatus() {
    const response = await api.get('/settings/budget-status')
    return response.data
  }
}


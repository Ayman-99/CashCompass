import api from './api'

export const auditService = {
  async getAuditLogs(params = {}) {
    const response = await api.get('/audit', { params })
    return response.data
  },

  async clearAuditTrail() {
    const response = await api.delete('/audit')
    return response.data
  }
}


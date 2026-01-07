import api from './api'

const analyticsService = {
  async getData(startDate = null, endDate = null) {
    const params = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    const response = await api.get('/data', { params })
    return response.data
  },

  async getAnalytics(startDate = null, endDate = null) {
    const params = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    const response = await api.get('/analytics', { params })
    return response.data
  },

  async getEnhancedAnalytics(startDate = null, endDate = null) {
    const params = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    const response = await api.get('/analytics/enhanced', { params })
    return response.data
  },

  async getPredictions(startDate = null, endDate = null) {
    const params = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    const response = await api.get('/predictions', { params })
    return response.data
  },

  async getTips(startDate = null, endDate = null) {
    const params = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    const response = await api.get('/tips', { params })
    return response.data
  },

  async getRecurring(startDate = null, endDate = null) {
    const params = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    const response = await api.get('/recurring', { params })
    return response.data
  },

  async getAdvancedAnalytics(startDate = null, endDate = null) {
    const params = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    const response = await api.get('/analytics/advanced', { params })
    return response.data
  },

  async getSpendingPatterns(startDate = null, endDate = null) {
    const params = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    const response = await api.get('/analytics/patterns', { params })
    return response.data
  },

  async getMerchants(startDate = null, endDate = null) {
    const params = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    const response = await api.get('/analytics/merchants', { params })
    return response.data
  },

  async getCashFlowCalendar(startDate = null, endDate = null) {
    const params = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    const response = await api.get('/analytics/cashflow-calendar', { params })
    return response.data
  },

  async getHealthScore(startDate = null, endDate = null) {
    const params = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    const response = await api.get('/analytics/health-score', { params })
    return response.data
  },

  async getSpendingVelocity(startDate = null, endDate = null) {
    const params = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    const response = await api.get('/analytics/velocity', { params })
    return response.data
  },

  async getAIInsights(startDate = null, endDate = null) {
    const params = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    const response = await api.get('/analytics/insights', { params })
    return response.data
  },

  async getLoans(startDate = null, endDate = null) {
    const params = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    const response = await api.get('/loans', { params })
    return response.data
  },

  async getExpensesByPerson(startDate = null, endDate = null) {
    const params = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    const response = await api.get('/analytics/expenses-by-person', { params })
    return response.data
  },

  async getDebtByPerson(startDate = null, endDate = null) {
    const params = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    const response = await api.get('/analytics/debt-by-person', { params })
    return response.data
  }
}

export default analyticsService


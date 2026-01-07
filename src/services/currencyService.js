import api from './api'

export const currencyService = {
  async getCurrencies() {
    const response = await api.get('/currencies')
    return response.data
  },

  async getCurrency(id) {
    const response = await api.get(`/currencies/${id}`)
    return response.data
  },

  async createCurrency(data) {
    const response = await api.post('/currencies', data)
    return response.data
  },

  async updateCurrency(id, data) {
    const response = await api.put(`/currencies/${id}`, data)
    return response.data
  },

  async deleteCurrency(id) {
    const response = await api.delete(`/currencies/${id}`)
    return response.data
  },

  async getExchangeRate(from, to) {
    const response = await api.get('/currencies/exchange', {
      params: { from, to }
    })
    return response.data
  },

  async updateExchangeRate(currencyId, rate) {
    const response = await api.put(`/currencies/${currencyId}/rate`, { rate })
    return response.data
  },

  async fetchLatestRates() {
    const response = await api.post('/currencies/fetch-rates')
    return response.data
  }
}


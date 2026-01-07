import api from './api'

export const exportService = {
  async exportTransactions(format = 'json') {
    const response = await api.get('/export/transactions', {
      params: { format },
      responseType: 'blob'
    })
    return response.data
  },

  async exportAccounts() {
    const response = await api.get('/export/accounts', {
      responseType: 'blob'
    })
    return response.data
  },

  async exportCategories() {
    const response = await api.get('/export/categories', {
      responseType: 'blob'
    })
    return response.data
  },

  async exportCurrencies() {
    const response = await api.get('/export/currencies', {
      responseType: 'blob'
    })
    return response.data
  },

  async exportAll() {
    const response = await api.get('/export/all', {
      responseType: 'blob'
    })
    return response.data
  },

  async importData(data, options = {}) {
    const response = await api.post('/export/import', { data, options })
    return response.data
  },

  // Helper to download file
  downloadFile(blob, filename, contentType = null) {
    // If blob is actually text/string, convert to blob
    if (typeof blob === 'string') {
      blob = new Blob([blob], { type: contentType || 'text/plain' })
    }
    
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }
}


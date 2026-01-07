<template>
  <div class="currencies">
    <div class="container">
      <div class="page-header">
        <h1>💱 Currencies</h1>
        <div class="header-actions">
          <button 
            @click="fetchLatestRates" 
            class="btn btn-fetch"
            :disabled="fetchingRates"
          >
            <span v-if="!fetchingRates">🔄 Fetch Latest Rates</span>
            <span v-else>⏳ Fetching...</span>
          </button>
          <button @click="showAddModal = true" class="btn btn-primary">+ Add Currency</button>
        </div>
      </div>

      <!-- Fetch Status Message -->
      <div v-if="fetchStatus" :class="['fetch-status', fetchStatusType]">
        {{ fetchStatus }}
      </div>

      <div v-if="loading" class="loading">Loading currencies...</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      
      <div v-else>
        <!-- Cards View -->
        <div class="currencies-cards-section">
          <h2>Currency Cards</h2>
          <div class="currencies-grid">
            <div 
              v-for="currency in currencies" 
              :key="currency.id" 
              class="currency-card"
              :class="{ 'base-currency': currency.isBase, 'inactive': !currency.isActive }"
              @click="editCurrency(currency)"
            >
              <div class="currency-card-header">
                <div class="currency-icon">💱</div>
                <div class="currency-actions-card">
                  <button 
                    @click.stop="editCurrency(currency)" 
                    class="icon-btn edit-btn"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button 
                    @click.stop="deleteCurrency(currency.id)" 
                    class="icon-btn delete-btn"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <div class="currency-card-body">
                <div class="currency-code-large">{{ currency.code }}</div>
                <div class="currency-name-text">{{ currency.name }}</div>
                <div class="currency-rate">
                  <span class="rate-label">Rate to ILS:</span>
                  <span class="rate-value">{{ formatNumber(currency.rateToILS) }}</span>
                </div>
                <div class="currency-badges">
                  <span v-if="currency.isBase" class="badge badge-base">Base</span>
                  <span v-if="!currency.isActive" class="badge badge-inactive">Inactive</span>
                </div>
                <div v-if="currency.lastUpdated" class="currency-updated">
                  Updated: {{ formatDate(currency.lastUpdated) }}
                </div>
              </div>
            </div>
            
            <!-- Add New Card -->
            <div class="currency-card add-card" @click="showAddModal = true">
              <div class="add-card-content">
                <div class="add-icon">+</div>
                <div class="add-text">Add New Currency</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Table View -->
        <div class="currencies-table-section">
          <h2>Currencies Table</h2>
          <div class="card">
            <div class="table-controls">
              <div class="table-search">
                <input 
                  v-model="searchQuery" 
                  type="text" 
                  placeholder="🔍 Search currencies..." 
                  class="search-input"
                />
              </div>
              <div class="view-toggle">
                <button 
                  @click="viewMode = 'cards'"
                  :class="['view-btn', { active: viewMode === 'cards' }]"
                >
                  📋 Cards
                </button>
                <button 
                  @click="viewMode = 'table'"
                  :class="['view-btn', { active: viewMode === 'table' }]"
                >
                  📊 Table
                </button>
              </div>
            </div>
            
            <div v-if="viewMode === 'table'">
              <table class="currencies-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Rate to ILS</th>
                    <th>Status</th>
                    <th>Last Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr 
                    v-for="currency in filteredCurrencies" 
                    :key="currency.id"
                    :class="{ 'base-row': currency.isBase, 'inactive-row': !currency.isActive }"
                  >
                    <td>
                      <div class="table-currency-code">
                        <span class="currency-icon-small">💱</span>
                        <strong>{{ currency.code }}</strong>
                      </div>
                    </td>
                    <td>{{ currency.name }}</td>
                    <td class="rate-cell">
                      <span class="rate-value-table">{{ formatNumber(currency.rateToILS) }}</span>
                    </td>
                    <td>
                      <div class="status-badges">
                        <span v-if="currency.isBase" class="badge badge-base">Base</span>
                        <span v-if="!currency.isActive" class="badge badge-inactive">Inactive</span>
                        <span v-if="currency.isActive && !currency.isBase" class="badge badge-active">Active</span>
                      </div>
                    </td>
                    <td>
                      <span class="date-text">{{ formatDate(currency.lastUpdated) }}</span>
                    </td>
                    <td>
                      <div class="table-actions">
                        <button @click="editCurrency(currency)" class="btn-icon" title="Edit">
                          ✏️
                        </button>
                        <button @click="deleteCurrency(currency.id)" class="btn-icon danger" title="Delete">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Add/Edit Modal -->
      <CurrencyModal
        v-if="showAddModal || editingCurrency"
        :currency="editingCurrency"
        @close="closeModal"
        @saved="handleCurrencySaved"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { currencyService } from '../services/currencyService'
import CurrencyModal from '../components/CurrencyModal.vue'
import { format } from 'date-fns'

const currencies = ref([])
const loading = ref(false)
const error = ref(null)
const showAddModal = ref(false)
const editingCurrency = ref(null)
const searchQuery = ref('')
const viewMode = ref('cards')
const fetchingRates = ref(false)
const fetchStatus = ref('')
const fetchStatusType = ref('')

const formatNumber = (num) => {
  if (!num) return '0.00'
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  }).format(num)
}

const formatDate = (date) => {
  if (!date) return '-'
  return format(new Date(date), 'MMM dd, yyyy HH:mm')
}

const filteredCurrencies = computed(() => {
  if (!searchQuery.value) return currencies.value
  const query = searchQuery.value.toLowerCase()
  return currencies.value.filter(currency => 
    currency.code.toLowerCase().includes(query) ||
    currency.name.toLowerCase().includes(query)
  )
})

const loadCurrencies = async () => {
  loading.value = true
  error.value = null
  
  try {
    const data = await currencyService.getCurrencies()
    currencies.value = data.currencies || data
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to load currencies'
    console.error('Currencies error:', err)
  } finally {
    loading.value = false
  }
}

const editCurrency = (currency) => {
  editingCurrency.value = currency
}

const deleteCurrency = async (id) => {
  if (!confirm('Are you sure you want to delete this currency?')) return
  
  try {
    await currencyService.deleteCurrency(id)
    loadCurrencies()
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to delete currency'
  }
}

const closeModal = () => {
  showAddModal.value = false
  editingCurrency.value = null
}

const handleCurrencySaved = () => {
  closeModal()
  loadCurrencies()
}

const fetchLatestRates = async () => {
  fetchingRates.value = true
  fetchStatus.value = 'Fetching rates from Currency API...'
  fetchStatusType.value = 'info'
  
  try {
    const data = await currencyService.fetchLatestRates()
    
    if (data.success) {
      let message = data.message || `Updated ${data.updated?.length || 0} currency rate(s)`
      
      if (data.errors && data.errors.length > 0) {
        const errorDetails = data.errors.map(e => `${e.code}: ${e.error}`).join(', ')
        message += `\nErrors: ${errorDetails}`
        fetchStatusType.value = 'warning'
      } else {
        fetchStatusType.value = 'success'
      }
      
      fetchStatus.value = message
      
      // Reload currencies to show updated rates
      await loadCurrencies()
      
      // Clear status after 8 seconds
      setTimeout(() => {
        fetchStatus.value = ''
      }, 8000)
    } else {
      fetchStatus.value = `Error: ${data.error || 'Failed to fetch rates'}`
      fetchStatusType.value = 'error'
    }
  } catch (err) {
    fetchStatus.value = `Error: ${err.response?.data?.error || err.message || 'Failed to fetch rates'}`
    fetchStatusType.value = 'error'
    console.error('Fetch rates error:', err)
  } finally {
    fetchingRates.value = false
  }
}

onMounted(() => {
  loadCurrencies()
})
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 12px;
}

.page-header h1 {
  margin: 0;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.btn-fetch {
  background: linear-gradient(135deg, #11998e, #38ef7d);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-fetch:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(17, 153, 142, 0.4);
}

.btn-fetch:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.fetch-status {
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 14px;
  white-space: pre-line;
}

.fetch-status.info {
  background: #e3f2fd;
  border-left: 4px solid #2196f3;
  color: #1976d2;
}

.fetch-status.success {
  background: #e8f5e9;
  border-left: 4px solid #4caf50;
  color: #2e7d32;
}

.fetch-status.warning {
  background: var(--warning-bg);
  border-left: 4px solid #ff9800;
  color: #e65100;
}

.fetch-status.error {
  background: #ffebee;
  border-left: 4px solid #f44336;
  color: #c62828;
}

/* Cards Section */
.currencies-cards-section {
  margin-bottom: 40px;
}

.currencies-cards-section h2 {
  margin-bottom: 20px;
  color: var(--text-primary);
  font-size: 20px;
}

.currencies-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.currency-card {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px var(--shadow);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.currency-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #11998e, #38ef7d);
}

.currency-card.base-currency::before {
  background: linear-gradient(90deg, #f093fb, #f5576c);
}

.currency-card.inactive {
  opacity: 0.7;
}

.currency-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px var(--shadow);
}

.currency-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.currency-icon {
  font-size: 32px;
}

.currency-actions-card {
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.currency-card:hover .currency-actions-card {
  opacity: 1;
}

.icon-btn {
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.icon-btn:hover {
  transform: scale(1.1);
}

.delete-btn:hover {
  background: #ffebee;
}

.edit-btn:hover {
  background: #e3f2fd;
}

.currency-card-body {
  text-align: center;
}

.currency-code-large {
  font-size: 36px;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 8px;
  letter-spacing: 2px;
}

.currency-name-text {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 16px;
}

.currency-rate {
  margin-bottom: 12px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 8px;
}

.rate-label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.rate-value {
  display: block;
  font-size: 24px;
  font-weight: bold;
  color: var(--text-primary);
}

.currency-badges {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge-base {
  background: linear-gradient(135deg, #f093fb, #f5576c);
  color: white;
}

.badge-inactive {
  background: #6c757d;
  color: white;
}

.badge-active {
  background: #28a745;
  color: white;
}

.currency-updated {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 8px;
}

/* Add Card */
.add-card {
  border: 2px dashed var(--border-color);
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 280px;
}

.add-card:hover {
  border-color: #11998e;
  background: rgba(17, 153, 142, 0.05);
}

.add-card-content {
  text-align: center;
}

.add-icon {
  font-size: 48px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.add-text {
  color: var(--text-secondary);
  font-weight: 600;
}

/* Table Section */
.currencies-table-section {
  margin-top: 40px;
}

.currencies-table-section h2 {
  margin-bottom: 20px;
  color: var(--text-primary);
  font-size: 20px;
}

.table-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  gap: 16px;
  flex-wrap: wrap;
}

.table-search {
  flex: 1;
  min-width: 200px;
}

.search-input {
  width: 100%;
  padding: 10px 16px;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 14px;
}

.view-toggle {
  display: flex;
  gap: 8px;
}

.view-btn {
  padding: 8px 16px;
  border: 2px solid var(--input-border);
  border-radius: 8px;
  background: var(--input-bg);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.view-btn:hover {
  border-color: #11998e;
}

.view-btn.active {
  background: #11998e;
  color: white;
  border-color: #11998e;
}

.currencies-table {
  width: 100%;
  border-collapse: collapse;
}

.currencies-table th {
  text-align: left;
  padding: 12px;
  border-bottom: 2px solid var(--border-color);
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.currencies-table td {
  padding: 16px 12px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
}

.currencies-table tr:hover {
  background: var(--bg-tertiary);
}

.currencies-table tr.base-row {
  background: rgba(240, 147, 251, 0.1);
}

.currencies-table tr.inactive-row {
  opacity: 0.6;
}

.table-currency-code {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.currency-icon-small {
  font-size: 18px;
}

.rate-cell {
  font-size: 16px;
  font-weight: 600;
}

.rate-value-table {
  color: var(--text-primary);
}

.status-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.date-text {
  font-size: 13px;
  color: var(--text-secondary);
}

.table-actions {
  display: flex;
  gap: 8px;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: var(--bg-tertiary);
  transform: scale(1.1);
}

.btn-icon.danger:hover {
  background: #ffebee;
}
</style>

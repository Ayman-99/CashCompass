<template>
  <div class="accounts">
    <div class="container">
      <div class="page-header">
        <h1>🏦 Accounts</h1>
        <div class="header-actions">
          <button @click="loadAccounts" class="btn btn-secondary" title="Refresh accounts">
            🔄 Refresh
          </button>
          <button @click="showAddModal = true" class="btn btn-primary">+ Add Account</button>
        </div>
      </div>

      <div v-if="loading" class="loading">Loading accounts...</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      
      <div v-else>
        <!-- Cards View -->
        <div class="accounts-cards-section">
          <h2>Account Cards</h2>
          <div class="accounts-grid">
            <div 
              v-for="account in accounts" 
              :key="account.id" 
              class="account-card"
              @click="editAccount(account)"
            >
              <div class="account-card-header">
                <div class="account-icon">🏦</div>
                <div class="account-actions-card">
                  <button 
                    @click.stop="editAccount(account)" 
                    class="icon-btn edit-btn"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button 
                    @click.stop="deleteAccount(account.id)" 
                    class="icon-btn delete-btn"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <div class="account-card-body">
                <h3 class="account-name">{{ account.name }}</h3>
                <div class="account-balance-large">
                  {{ formatCurrency(account.balance) }}
                </div>
                <div class="account-currency-badge">{{ account.currency }}</div>
              </div>
            </div>
            
            <!-- Add New Card -->
            <div class="account-card add-card" @click="showAddModal = true">
              <div class="add-card-content">
                <div class="add-icon">+</div>
                <div class="add-text">Add New Account</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Table View -->
        <div class="accounts-table-section">
          <h2>Accounts Table</h2>
          <div class="card">
            <div class="table-controls">
              <div class="table-search">
                <input 
                  v-model="searchQuery" 
                  type="text" 
                  placeholder="🔍 Search accounts..." 
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
              <table class="accounts-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Balance</th>
                    <th>Currency</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="account in filteredAccounts" :key="account.id">
                    <td>
                      <div class="table-account-name">
                        <span class="account-icon-small">🏦</span>
                        {{ account.name }}
                      </div>
                    </td>
                    <td class="balance-cell">
                      <span class="balance-value">{{ formatCurrency(account.balance) }}</span>
                    </td>
                    <td>
                      <span class="currency-badge">{{ account.currency }}</span>
                    </td>
                    <td>
                      <div class="table-actions">
                        <button @click="editAccount(account)" class="btn-icon" title="Edit">
                          ✏️
                        </button>
                        <button @click="deleteAccount(account.id)" class="btn-icon danger" title="Delete">
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
      <AccountModal
        v-if="showAddModal || editingAccount"
        :account="editingAccount"
        @close="closeModal"
        @saved="handleAccountSaved"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { accountService } from '../services/accountService'
import AccountModal from '../components/AccountModal.vue'

const accounts = ref([])
const loading = ref(false)
const error = ref(null)
const showAddModal = ref(false)
const editingAccount = ref(null)
const searchQuery = ref('')
const viewMode = ref('cards')

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 2
  }).format(amount || 0)
}

const filteredAccounts = computed(() => {
  if (!searchQuery.value) return accounts.value
  const query = searchQuery.value.toLowerCase()
  return accounts.value.filter(account => 
    account.name.toLowerCase().includes(query) ||
    account.currency.toLowerCase().includes(query)
  )
})

const loadAccounts = async () => {
  loading.value = true
  error.value = null
  
  try {
    const data = await accountService.getAccounts()
    accounts.value = data.accounts || data
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to load accounts'
    console.error('Accounts error:', err)
  } finally {
    loading.value = false
  }
}

const editAccount = (account) => {
  editingAccount.value = account
}

const deleteAccount = async (id) => {
  if (!confirm('Are you sure you want to delete this account?')) return
  
  try {
    await accountService.deleteAccount(id)
    loadAccounts()
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to delete account'
  }
}

const closeModal = () => {
  showAddModal.value = false
  editingAccount.value = null
}

const handleAccountSaved = () => {
  closeModal()
  loadAccounts()
}

onMounted(() => {
  loadAccounts()
})
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.page-header h1 {
  margin: 0;
  color: var(--text-primary);
}

/* Cards Section */
.accounts-cards-section {
  margin-bottom: 40px;
}

.accounts-cards-section h2 {
  margin-bottom: 20px;
  color: var(--text-primary);
  font-size: 20px;
}

.accounts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.account-card {
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

.account-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #667eea, #764ba2);
}

.account-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px var(--shadow);
}

.account-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.account-icon {
  font-size: 32px;
}

.account-actions-card {
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.account-card:hover .account-actions-card {
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

.account-card-body {
  text-align: center;
}

.account-name {
  margin: 0 0 12px 0;
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 600;
}

.account-balance-large {
  font-size: 32px;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.account-currency-badge {
  display: inline-block;
  padding: 6px 16px;
  background: var(--bg-tertiary);
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Add Card */
.add-card {
  border: 2px dashed var(--border-color);
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.add-card:hover {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.05);
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
.accounts-table-section {
  margin-top: 40px;
}

.accounts-table-section h2 {
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
  border-color: #667eea;
}

.view-btn.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.accounts-table {
  width: 100%;
  border-collapse: collapse;
}

.accounts-table th {
  text-align: left;
  padding: 12px;
  border-bottom: 2px solid var(--border-color);
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.accounts-table td {
  padding: 16px 12px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
}

.accounts-table tr:hover {
  background: var(--bg-tertiary);
}

.table-account-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.account-icon-small {
  font-size: 18px;
}

.balance-cell {
  font-size: 18px;
  font-weight: 600;
}

.balance-value {
  color: var(--text-primary);
}

.currency-badge {
  display: inline-block;
  padding: 4px 12px;
  background: var(--bg-tertiary);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
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

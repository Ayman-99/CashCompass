<template>
  <div class="transactions">
    <div class="container">
      <div class="page-header">
        <h1>Transactions</h1>
        <button @click="showAddModal = true" class="btn btn-primary">Add Transaction</button>
      </div>

      <!-- Filters -->
      <div class="card">
        <div class="filters">
          <div class="form-group" style="flex: 1;">
            <input
              v-model="filters.search"
              type="text"
              placeholder="Search transactions..."
              @input="loadTransactions"
            />
          </div>
          <div class="form-group" style="display: flex; align-items: center; gap: 8px; padding: 0 8px;">
            <label style="display:flex; align-items:center; gap:8px; margin:0;">
              <input type="checkbox" v-model="filters.includeExcluded" @change="loadTransactions" />
              Include excluded
            </label>
          </div>
          <div class="form-group" style="width: 200px;">
            <select v-model="filters.account_id" @change="loadTransactions">
              <option value="">All Accounts</option>
              <option v-for="account in accounts" :key="account.id" :value="account.id">
                {{ account.name }}
              </option>
            </select>
          </div>
          <div class="form-group" style="width: 200px;">
            <select v-model="filters.type" @change="loadTransactions">
              <option value="">All Types</option>
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
              <option value="Transfer">Transfer</option>
            </select>
          </div>
          <div class="form-group" style="width: 200px;">
            <select v-model="filters.dateRange" @change="applyDateRange">
              <option value="">All Time</option>
              <option value="thisMonth">This Month</option>
              <option value="last3Months">Last 3 Months</option>
              <option value="thisYear">This Year</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Transactions Table -->
      <div class="card">
        <div v-if="loading" class="loading">Loading transactions...</div>
        <div v-else-if="error" class="error">{{ error }}</div>
        <div v-else>
          <table class="transactions-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Account</th>
                <th>Category</th>
                <th>Person/Company</th>
                <th>Description</th>
                <th>Excluded</th>
                <th>Amount</th>
                <th>Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="transaction in transactions" :key="transaction.id">
                <td>{{ formatDate(transaction.dateIso) }}</td>
                <td>{{ transaction.account_name || transaction.account }}</td>
                <td>{{ transaction.category_name || transaction.category || '-' }}</td>
                <td>
                  <span v-if="transaction.personCompany || transaction.person_company" class="person-badge">
                    {{ transaction.personCompany || transaction.person_company }}
                  </span>
                  <span v-else class="no-person">-</span>
                </td>
                <td>{{ transaction.description || '-' }}</td>
                <td>
                  <span v-if="transaction.excludeFromReports || transaction.exclude_from_reports" class="excluded-badge">Excluded</span>
                  <span v-else class="no-excluded">-</span>
                </td>
                <td :class="{ 'amount-income': transaction.type === 'Income', 'amount-expense': transaction.type === 'Expense' }">
                  {{ formatCurrency(transaction.amount) }}
                </td>
                <td>
                  <span class="badge" :class="`badge-${transaction.type.toLowerCase()}`">
                    {{ transaction.type }}
                  </span>
                </td>
                <td>
                  <button @click="editTransaction(transaction)" class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px;">Edit</button>
                  <button @click="deleteTransaction(transaction.id)" class="btn btn-danger" style="padding: 4px 8px; font-size: 12px; margin-left: 4px;">Delete</button>
                </td>
              </tr>
            </tbody>
          </table>
          
          <div class="pagination" v-if="total > limit">
            <button @click="loadPage(currentPage - 1)" :disabled="currentPage === 1" class="btn btn-secondary">
              Previous
            </button>
            <span>Page {{ currentPage }} of {{ Math.ceil(total / limit) }}</span>
            <button @click="loadPage(currentPage + 1)" :disabled="currentPage >= Math.ceil(total / limit)" class="btn btn-secondary">
              Next
            </button>
          </div>
        </div>
      </div>

      <!-- Add/Edit Modal -->
      <TransactionModal
        v-if="showAddModal || editingTransaction"
        :transaction="editingTransaction"
        :accounts="accounts"
        :categories="categories"
        @close="closeModal"
        @saved="handleTransactionSaved"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { transactionService } from '../services/transactionService'
import { accountService } from '../services/accountService'
import { categoryService } from '../services/categoryService'
import TransactionModal from '../components/TransactionModal.vue'
import { format, subMonths, startOfYear } from 'date-fns'

const transactions = ref([])
const accounts = ref([])
const categories = ref([])
const loading = ref(false)
const error = ref(null)
const showAddModal = ref(false)
const editingTransaction = ref(null)
const total = ref(0)
const limit = ref(50)
const currentPage = ref(1)

const filters = ref({
  search: '',
  account_id: '',
  category_id: '',
  type: '',
  includeExcluded: true,
  dateRange: '',
  startDate: null,
  endDate: null
})

const formatDate = (date) => {
  if (!date) return '-'
  return format(new Date(date), 'MMM dd, yyyy')
}

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 2
  }).format(amount)
}

const applyDateRange = () => {
  const now = new Date()
  switch (filters.value.dateRange) {
    case 'thisMonth':
      filters.value.startDate = format(startOfYear(now), 'yyyy-MM-dd')
      filters.value.endDate = format(now, 'yyyy-MM-dd')
      break
    case 'last3Months':
      filters.value.startDate = format(subMonths(now, 3), 'yyyy-MM-dd')
      filters.value.endDate = format(now, 'yyyy-MM-dd')
      break
    case 'thisYear':
      filters.value.startDate = format(startOfYear(now), 'yyyy-MM-dd')
      filters.value.endDate = format(now, 'yyyy-MM-dd')
      break
    default:
      filters.value.startDate = null
      filters.value.endDate = null
  }
  loadTransactions()
}

const loadAccounts = async () => {
  try {
    const data = await accountService.getAccounts()
    accounts.value = data.accounts || data
  } catch (err) {
    console.error('Failed to load accounts:', err)
  }
}

const loadCategories = async () => {
  try {
    const data = await categoryService.getCategories()
    categories.value = data.categories || data
  } catch (err) {
    console.error('Failed to load categories:', err)
  }
}

const loadTransactions = async () => {
  loading.value = true
  error.value = null
  
  try {
    const params = {
      limit: limit.value,
      offset: (currentPage.value - 1) * limit.value,
      includeExcluded: filters.value.includeExcluded ? 'true' : 'false'
    }
    
    if (filters.value.search) params.search = filters.value.search
    if (filters.value.account_id) params.account_id = filters.value.account_id
    if (filters.value.category_id) params.category_id = filters.value.category_id
    if (filters.value.type) params.type = filters.value.type
    if (filters.value.startDate) params.startDate = filters.value.startDate
    if (filters.value.endDate) params.endDate = filters.value.endDate
    
    const data = await transactionService.getTransactions(params)
    transactions.value = data.transactions || []
    total.value = data.total || 0
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to load transactions'
    console.error('Transactions error:', err)
  } finally {
    loading.value = false
  }
}

const loadPage = (page) => {
  currentPage.value = page
  loadTransactions()
}

const editTransaction = (transaction) => {
  editingTransaction.value = transaction
}

const deleteTransaction = async (id) => {
  if (!confirm('Are you sure you want to delete this transaction?')) return
  
  try {
    await transactionService.deleteTransaction(id)
    loadTransactions()
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to delete transaction'
  }
}

const closeModal = () => {
  showAddModal.value = false
  editingTransaction.value = null
  // Refresh accounts in case a new one was added from Accounts page
  loadAccounts()
}

const handleTransactionSaved = () => {
  closeModal()
  loadTransactions()
}

// Refresh accounts when modal opens to ensure latest accounts are available
watch([showAddModal, editingTransaction], ([newShowAdd, newEditing]) => {
  if (newShowAdd || newEditing) {
    loadAccounts()
  }
})

onMounted(() => {
  loadAccounts()
  loadCategories()
  loadTransactions()
})
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.filters {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.transactions-table {
  width: 100%;
  border-collapse: collapse;
}

.transactions-table th {
  text-align: left;
  padding: 12px;
  border-bottom: 2px solid #ddd;
  font-weight: 600;
  color: #666;
}

.transactions-table td {
  padding: 12px;
  border-bottom: 1px solid #eee;
}

.transactions-table tr:hover {
  background-color: #f8f9fa;
}

.amount-income {
  color: #28a745;
  font-weight: 600;
}

.amount-expense {
  color: #dc3545;
  font-weight: 600;
}

.badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.badge-income {
  background: #d4edda;
  color: #155724;
}

.badge-expense {
  background: #f8d7da;
  color: #721c24;
}

.badge-transfer {
  background: #d1ecf1;
  color: #0c5460;
}

.person-badge {
  padding: 4px 8px;
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.no-person {
  color: #999;
  font-style: italic;
}

.excluded-badge {
  padding: 4px 8px;
  background: rgba(220, 53, 69, 0.08);
  color: #dc3545;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.no-excluded {
  color: #999;
  font-style: italic;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
}
</style>


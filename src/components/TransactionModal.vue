<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <div class="modal-header">
        <h2>{{ transaction ? 'Edit Transaction' : 'Add Transaction' }}</h2>
        <button @click="close" class="close-btn">&times;</button>
      </div>
      
      <form @submit.prevent="save">
        <div class="form-group">
          <label>Account *</label>
          <select v-model="formData.account_id" required>
            <option value="">Select Account</option>
            <option v-for="account in accounts" :key="account.id" :value="account.id">
              {{ account.name }}
            </option>
          </select>
        </div>
        
        <div class="form-group">
          <label>Category</label>
          <select v-model="formData.category_id">
            <option value="">No Category</option>
            <option v-for="category in categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
        </div>

        <div class="form-group checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="formData.exclude_from_reports" />
            Exclude from reports & balances (logging only)
          </label>
          <small class="form-hint">
            If enabled, this transaction will not affect dashboards/analytics or account balances. Useful for notes like “debt forgiven”.
          </small>
        </div>
        
        <div class="form-group">
          <label>Type *</label>
          <select v-model="formData.type" required>
            <option value="">Select Type</option>
            <option value="Income">Income</option>
            <option value="Expense">Expense</option>
            <option value="Transfer">Transfer</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>Date *</label>
          <input v-model="formData.date_iso" type="datetime-local" required />
        </div>
        
        <div class="form-group">
          <label>Amount *</label>
          <input v-model.number="formData.amount" type="number" step="0.01" required />
        </div>
        
        <div class="form-group">
          <label>Currency</label>
          <input v-model="formData.currency" type="text" placeholder="ILS" />
        </div>
        
        <div class="form-group">
          <label>Person/Company</label>
          <input 
            v-model="formData.person_company" 
            type="text" 
            placeholder="e.g., John Doe, Company Name"
            list="people-list"
          />
          <datalist id="people-list">
            <option v-for="person in knownPeople" :key="person" :value="person" />
          </datalist>
          <small class="form-hint">💡 Track loans/debts or spending with specific people. For loans: Expense = lend, Income = repaid. For Debt category: tracks debt transactions per person.</small>
        </div>
        
        <div class="form-group">
          <label>Description</label>
          <textarea v-model="formData.description" rows="3"></textarea>
        </div>
        
        <div class="modal-actions">
          <button type="button" @click="close" class="btn btn-secondary">Cancel</button>
          <button type="submit" class="btn btn-primary" :disabled="loading">
            {{ loading ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { transactionService } from '../services/transactionService'
import { format } from 'date-fns'

const props = defineProps({
  transaction: Object,
  accounts: Array,
  categories: Array
})

const emit = defineEmits(['close', 'saved'])

const loading = ref(false)
const knownPeople = ref([])

const formData = ref({
  account_id: '',
  category_id: '',
  type: '',
  date_iso: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  amount: 0,
  currency: 'ILS',
  converted_amount: 0,
  person_company: '',
  exclude_from_reports: false,
  description: ''
})

watch(() => props.transaction, (newVal) => {
  if (newVal) {
    formData.value = {
      account_id: newVal.accountId || newVal.account_id || '',
      category_id: newVal.categoryId || newVal.category_id || '',
      type: newVal.type || '',
      date_iso: newVal.dateIso ? format(new Date(newVal.dateIso), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      amount: newVal.amount || 0,
      currency: newVal.currency || 'ILS',
      converted_amount: newVal.convertedAmount || newVal.converted_amount || newVal.amount || 0,
      person_company: newVal.personCompany || newVal.person_company || '',
      exclude_from_reports: newVal.excludeFromReports || newVal.exclude_from_reports || false,
      description: newVal.description || ''
    }
  }
}, { immediate: true })

// Load known people from transactions
onMounted(async () => {
  try {
    const response = await transactionService.getTransactions({ limit: 1000 })
    const people = new Set()
    response.transactions?.forEach(tx => {
      if (tx.personCompany || tx.person_company) {
        people.add(tx.personCompany || tx.person_company)
      }
    })
    knownPeople.value = Array.from(people).sort()
  } catch (error) {
    console.error('Error loading known people:', error)
  }
})

const close = () => {
  emit('close')
}

const save = async () => {
  loading.value = true
  try {
    const data = {
      account_id: parseInt(formData.value.account_id),
      category_id: formData.value.category_id ? parseInt(formData.value.category_id) : null,
      type: formData.value.type,
      date_iso: new Date(formData.value.date_iso).toISOString(),
      amount: parseFloat(formData.value.amount),
      currency: formData.value.currency || 'ILS',
      converted_amount: formData.value.converted_amount || parseFloat(formData.value.amount),
      person_company: formData.value.person_company?.trim() || null,
      exclude_from_reports: !!formData.value.exclude_from_reports,
      description: formData.value.description || null
    }
    
    if (props.transaction) {
      await transactionService.updateTransaction(props.transaction.id, data)
    } else {
      await transactionService.createTransaction(data)
    }
    
    emit('saved')
  } catch (error) {
    console.error('Save error:', error)
    alert(error.response?.data?.error || 'Failed to save transaction')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: var(--card-bg);
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 24px;
  border: 1px solid var(--border-color);
  transition: background-color 0.3s ease, border-color 0.3s ease;
  animation: scaleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 32px;
  cursor: pointer;
  color: #666;
  line-height: 1;
}

.close-btn:hover {
  color: #333;
}

.form-hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary, #666);
  font-style: italic;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}
</style>


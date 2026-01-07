<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <div class="modal-header">
        <h2>{{ rule ? 'Edit Alert Rule' : 'Add Alert Rule' }}</h2>
        <button @click="close" class="close-btn">&times;</button>
      </div>
      
      <form @submit.prevent="save">
        <div class="form-group">
          <label>Rule Name *</label>
          <input v-model="formData.name" type="text" required placeholder="e.g., Monthly Budget" />
        </div>
        
        <div class="form-group">
          <label>Rule Type *</label>
          <select v-model="formData.ruleType" required>
            <option value="">Select Type</option>
            <option value="BUDGET_LIMIT">Budget Limit</option>
            <option value="LARGE_TRANSACTION">Large Transaction</option>
            <option value="MONTHLY_LIMIT">Monthly Limit</option>
            <option value="ACCOUNT_BALANCE">Account Balance</option>
            <option value="RECURRING_DETECTION">Recurring Detection</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>Threshold *</label>
          <input v-model.number="formData.threshold" type="number" step="0.01" required />
        </div>
        
        <div class="form-group">
          <label>Currency</label>
          <input v-model="formData.currency" type="text" placeholder="ILS" />
        </div>
        
        <div class="form-group">
          <label>Category</label>
          <select v-model="formData.categoryId">
            <option value="">No Category</option>
            <option v-for="category in categories" :key="category.id" :value="category.id">
              {{ category.name }} ({{ category.type }})
            </option>
          </select>
        </div>
        
        <div class="form-group">
          <label>Account</label>
          <select v-model="formData.accountId">
            <option value="">No Account</option>
            <option v-for="account in accounts" :key="account.id" :value="account.id">
              {{ account.name }}
            </option>
          </select>
        </div>
        
        <div class="form-group">
          <label>Period</label>
          <select v-model="formData.period">
            <option value="">No Period</option>
            <option value="MONTHLY">Monthly</option>
            <option value="WEEKLY">Weekly</option>
            <option value="DAILY">Daily</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>
            <input v-model="formData.isEnabled" type="checkbox" />
            Enabled
          </label>
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
import { ref, watch } from 'vue'
import { alertRuleService } from '../services/alertRuleService'

const props = defineProps({
  rule: Object,
  accounts: Array,
  categories: Array
})

const emit = defineEmits(['close', 'saved'])

const loading = ref(false)
const formData = ref({
  name: '',
  ruleType: '',
  threshold: 0,
  currency: 'ILS',
  categoryId: '',
  accountId: '',
  period: '',
  isEnabled: true
})

watch(() => props.rule, (newVal) => {
  if (newVal) {
    formData.value = {
      name: newVal.name || '',
      ruleType: newVal.ruleType || '',
      threshold: parseFloat(newVal.threshold) || 0,
      currency: newVal.currency || 'ILS',
      categoryId: newVal.categoryId || '',
      accountId: newVal.accountId || '',
      period: newVal.period || '',
      isEnabled: newVal.isEnabled !== undefined ? newVal.isEnabled : true
    }
  }
}, { immediate: true })

const close = () => {
  emit('close')
}

const save = async () => {
  loading.value = true
  try {
    const data = {
      name: formData.value.name,
      rule_type: formData.value.ruleType,
      threshold: parseFloat(formData.value.threshold),
      currency: formData.value.currency || 'ILS',
      category_id: formData.value.categoryId || null,
      account_id: formData.value.accountId || null,
      period: formData.value.period || null,
      is_enabled: formData.value.isEnabled
    }
    
    if (props.rule) {
      await alertRuleService.updateAlertRule(props.rule.id, data)
    } else {
      await alertRuleService.createAlertRule(data)
    }
    
    emit('saved')
  } catch (error) {
    console.error('Save error:', error)
    alert(error.response?.data?.error || 'Failed to save alert rule')
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
  padding: 24px;
  max-height: 90vh;
  overflow-y: auto;
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

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}
</style>


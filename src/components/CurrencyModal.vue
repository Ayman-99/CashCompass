<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <div class="modal-header">
        <h2>{{ currency ? 'Edit Currency' : 'Add Currency' }}</h2>
        <button @click="close" class="close-btn">&times;</button>
      </div>
      
      <form @submit.prevent="save">
        <div class="form-group">
          <label>Code *</label>
          <input v-model="formData.code" type="text" required placeholder="USD" maxlength="3" style="text-transform: uppercase;" />
          <small>3-letter currency code (e.g., USD, EUR, ILS)</small>
        </div>
        
        <div class="form-group">
          <label>Name *</label>
          <input v-model="formData.name" type="text" required placeholder="US Dollar" />
        </div>
        
        <div class="form-group">
          <label>Rate to ILS *</label>
          <input v-model.number="formData.rateToILS" type="number" step="0.000001" required />
          <small>Exchange rate: 1 {{ formData.code || 'XXX' }} = {{ formData.rateToILS || 0 }} ILS</small>
        </div>
        
        <div class="form-group">
          <label>
            <input v-model="formData.isBase" type="checkbox" />
            Base Currency (ILS)
          </label>
        </div>
        
        <div class="form-group">
          <label>
            <input v-model="formData.isActive" type="checkbox" />
            Active
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
import { currencyService } from '../services/currencyService'

const props = defineProps({
  currency: Object
})

const emit = defineEmits(['close', 'saved'])

const loading = ref(false)
const formData = ref({
  code: '',
  name: '',
  rateToILS: 1.0,
  isBase: false,
  isActive: true
})

watch(() => props.currency, (newVal) => {
  if (newVal) {
    formData.value = {
      code: newVal.code || '',
      name: newVal.name || '',
      rateToILS: parseFloat(newVal.rateToILS) || 1.0,
      isBase: newVal.isBase || false,
      isActive: newVal.isActive !== undefined ? newVal.isActive : true
    }
  }
}, { immediate: true })

watch(() => formData.value.code, (newVal) => {
  if (newVal) {
    formData.value.code = newVal.toUpperCase()
  }
})

const close = () => {
  emit('close')
}

const save = async () => {
  loading.value = true
  try {
    const data = {
      code: formData.value.code.toUpperCase(),
      name: formData.value.name,
      rate_to_ils: parseFloat(formData.value.rateToILS),
      is_base: formData.value.isBase,
      is_active: formData.value.isActive
    }
    
    if (props.currency) {
      await currencyService.updateCurrency(props.currency.id, data)
    } else {
      await currencyService.createCurrency(data)
    }
    
    emit('saved')
  } catch (error) {
    console.error('Save error:', error)
    alert(error.response?.data?.error || 'Failed to save currency')
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
  max-width: 500px;
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

.form-group small {
  display: block;
  margin-top: 4px;
  color: #666;
  font-size: 12px;
}
</style>


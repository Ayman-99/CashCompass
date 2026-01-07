<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <div class="modal-header">
        <h2>{{ account ? 'Edit Account' : 'Add Account' }}</h2>
        <button @click="close" class="close-btn">&times;</button>
      </div>
      
      <form @submit.prevent="save">
        <div class="form-group">
          <label>Name *</label>
          <input v-model="formData.name" type="text" required />
        </div>
        
        <div class="form-group">
          <label>Currency</label>
          <input v-model="formData.currency" type="text" placeholder="ILS" />
        </div>
        
        <div class="form-group">
          <label>Initial Balance</label>
          <input v-model.number="formData.balance" type="number" step="0.01" />
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
import { accountService } from '../services/accountService'

const props = defineProps({
  account: Object
})

const emit = defineEmits(['close', 'saved'])

const loading = ref(false)
const formData = ref({
  name: '',
  currency: 'ILS',
  balance: 0
})

watch(() => props.account, (newVal) => {
  if (newVal) {
    formData.value = {
      name: newVal.name || '',
      currency: newVal.currency || 'ILS',
      balance: parseFloat(newVal.balance) || 0
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
      currency: formData.value.currency || 'ILS',
      balance: parseFloat(formData.value.balance) || 0
    }
    
    if (props.account) {
      await accountService.updateAccount(props.account.id, data)
    } else {
      await accountService.createAccount(data)
    }
    
    emit('saved')
  } catch (error) {
    console.error('Save error:', error)
    alert(error.response?.data?.error || 'Failed to save account')
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


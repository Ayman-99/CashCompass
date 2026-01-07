<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <div class="modal-header">
        <h2>{{ user ? 'Edit User' : 'Add User' }}</h2>
        <button @click="close" class="close-btn">&times;</button>
      </div>
      
      <form @submit.prevent="save">
        <div class="form-group">
          <label>Username *</label>
          <input v-model="formData.username" type="text" required :disabled="!!user" />
        </div>
        
        <div class="form-group">
          <label>Email *</label>
          <input v-model="formData.email" type="email" required />
        </div>
        
        <div class="form-group" v-if="!user">
          <label>Password *</label>
          <input v-model="formData.password" type="password" required />
        </div>
        
        <div class="form-group">
          <label>
            <input v-model="formData.canAccessWeb" type="checkbox" />
            Web Access
          </label>
        </div>
        
        <div class="form-group">
          <label>Allowed IPs (comma-separated)</label>
          <input v-model="formData.allowedIps" type="text" placeholder="192.168.1.1, 10.0.0.1" />
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
import { adminService } from '../services/adminService'

const props = defineProps({
  user: Object
})

const emit = defineEmits(['close', 'saved'])

const loading = ref(false)
const formData = ref({
  username: '',
  email: '',
  password: '',
  canAccessWeb: false,
  allowedIps: ''
})

watch(() => props.user, (newVal) => {
  if (newVal) {
    formData.value = {
      username: newVal.username || '',
      email: newVal.email || '',
      password: '',
      canAccessWeb: newVal.canAccessWeb || false,
      allowedIps: newVal.allowedIps || ''
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
      username: formData.value.username,
      email: formData.value.email,
      canAccessWeb: formData.value.canAccessWeb,
      allowedIps: formData.value.allowedIps || null
    }
    
    if (props.user) {
      if (formData.value.password) {
        data.password = formData.value.password
      }
      await adminService.updateUser(props.user.id, data)
    } else {
      data.password = formData.value.password
      await adminService.createUser(data)
    }
    
    emit('saved')
  } catch (error) {
    console.error('Save error:', error)
    alert(error.response?.data?.error || 'Failed to save user')
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


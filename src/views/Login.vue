<template>
  <div class="login-container">
    <div class="login-card">
      <h1>Finance App</h1>
      <p class="subtitle">Sign in to your account</p>
      
      <div v-if="sessionExpired" class="session-expired">
        <strong>⚠️ Session Expired</strong>
        <p>{{ sessionMessage || 'Your session has expired after 2 days of inactivity. Please login again.' }}</p>
      </div>
      
      <div v-if="error" class="error">
        <strong>Login Failed:</strong> {{ error }}
        <div v-if="error.includes('Network') || error.includes('Failed to fetch')" style="margin-top: 8px; font-size: 12px;">
          Make sure the backend server is running on port 9001
        </div>
      </div>
      
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="username">Username or Email</label>
          <input
            id="username"
            v-model="username"
            type="text"
            required
            autocomplete="username"
            placeholder="Enter your username or email"
          />
        </div>
        
        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            placeholder="Enter your password"
          />
        </div>
        
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? 'Signing in...' : 'Sign In' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref(null)
const sessionExpired = ref(false)
const sessionMessage = ref('')

onMounted(() => {
  // Check if session expired
  const expired = sessionStorage.getItem('session_expired')
  const message = sessionStorage.getItem('session_message')
  
  if (expired === 'true' && message) {
    sessionExpired.value = true
    sessionMessage.value = message
    // Clear the session storage
    sessionStorage.removeItem('session_expired')
    sessionStorage.removeItem('session_message')
  }
})

const handleLogin = async () => {
  loading.value = true
  error.value = null
  
  const result = await authStore.login(username.value, password.value)
  
  if (result.success) {
    router.push('/dashboard')
  } else {
    error.value = result.error
  }
  
  loading.value = false
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

[data-theme="dark"] .login-container {
  background: linear-gradient(135deg, #1a1a2e 0%, #2a2a3e 100%);
}

.login-card {
  background: var(--card-bg);
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 10px 40px var(--shadow);
  width: 100%;
  max-width: 400px;
  border: 1px solid var(--border-color);
  transition: background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}

.login-card h1 {
  text-align: center;
  margin-bottom: 8px;
  color: var(--text-primary);
  transition: color 0.3s ease;
}

.subtitle {
  text-align: center;
  color: var(--text-secondary);
  margin-bottom: 32px;
  transition: color 0.3s ease;
}

.login-card form {
  margin-top: 24px;
}

.login-card .btn {
  width: 100%;
  padding: 12px;
  font-size: 16px;
  margin-top: 8px;
}

.login-card .btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.session-expired {
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
  color: #856404;
}

[data-theme="dark"] .session-expired {
  background: rgba(255, 193, 7, 0.2);
  border-color: #ffc107;
  color: #ffc107;
}

.session-expired strong {
  display: block;
  margin-bottom: 8px;
  font-size: 16px;
}

.session-expired p {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
}
</style>


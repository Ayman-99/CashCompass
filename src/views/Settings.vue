<template>
  <div class="settings">
    <div class="container">
      <h1>Settings</h1>
      
      <!-- Profile Section -->
      <div class="card">
        <h2>👤 Profile Information</h2>
        <div v-if="profileMessage" :class="profileMessageType" style="margin-bottom: 16px;">
          {{ profileMessage }}
        </div>
        <form @submit.prevent="saveProfile">
          <div class="form-group">
            <label>Username</label>
            <input v-model="profileForm.username" type="text" required />
          </div>
          <div class="form-group">
            <label>Email</label>
            <input v-model="profileForm.email" type="email" required />
          </div>
          <button type="submit" class="btn btn-primary" :disabled="profileLoading">
            {{ profileLoading ? 'Saving...' : 'Save Changes' }}
          </button>
        </form>
      </div>

      <!-- Password Section -->
      <div class="card">
        <h2>🔒 Change Password</h2>
        <div v-if="passwordMessage" :class="passwordMessageType" style="margin-bottom: 16px;">
          {{ passwordMessage }}
        </div>
        <form @submit.prevent="changePassword">
          <div class="form-group">
            <label>Current Password</label>
            <input v-model="passwordForm.oldPassword" type="password" required />
          </div>
          <div class="form-group">
            <label>New Password</label>
            <input v-model="passwordForm.newPassword" type="password" required minlength="6" />
          </div>
          <div class="form-group">
            <label>Confirm New Password</label>
            <input v-model="passwordForm.confirmPassword" type="password" required />
          </div>
          <button type="submit" class="btn btn-primary" :disabled="passwordLoading">
            {{ passwordLoading ? 'Changing...' : 'Change Password' }}
          </button>
        </form>
      </div>

      <!-- Export Data Section -->
      <div class="card">
        <h2>📥 Export Data</h2>
        <div class="info-box">
          <strong>ℹ️ About Data Export</strong>
          <p>Export your financial data in various formats. All exports include your transactions, accounts, categories, and currencies.</p>
        </div>
        <div class="export-options">
          <div class="export-card">
            <h3>📊 Transactions (CSV)</h3>
            <p>Export all transactions as CSV file</p>
            <button @click="exportData('transactions', 'csv')" class="btn btn-export" :disabled="exportLoading">
              Export CSV
            </button>
          </div>
          <div class="export-card">
            <h3>📊 Transactions (JSON)</h3>
            <p>Export all transactions as JSON file</p>
            <button @click="exportData('transactions', 'json')" class="btn btn-export" :disabled="exportLoading">
              Export JSON
            </button>
          </div>
          <div class="export-card">
            <h3>💼 Accounts</h3>
            <p>Export all accounts and balances</p>
            <button @click="exportData('accounts')" class="btn btn-export" :disabled="exportLoading">
              Export JSON
            </button>
          </div>
          <div class="export-card">
            <h3>📁 Categories</h3>
            <p>Export all categories</p>
            <button @click="exportData('categories')" class="btn btn-export" :disabled="exportLoading">
              Export JSON
            </button>
          </div>
          <div class="export-card">
            <h3>💱 Currencies</h3>
            <p>Export currency rates</p>
            <button @click="exportData('currencies')" class="btn btn-export" :disabled="exportLoading">
              Export JSON
            </button>
          </div>
          <div class="export-card">
            <h3>📦 Complete Export</h3>
            <p>Export everything as JSON</p>
            <button @click="exportData('all')" class="btn btn-export" :disabled="exportLoading">
              Export All
            </button>
          </div>
        </div>
        <div v-if="exportLoading" class="loading">Exporting data...</div>
      </div>

      <!-- Import Data Section -->
      <div class="card">
        <h2>📤 Import Data</h2>
        <div class="info-box">
          <strong>ℹ️ About Data Import</strong>
          <p>Import data from a previous export. The import will merge with existing data (creates new, updates existing).</p>
          <p><strong>What gets imported:</strong> Accounts (with balances), Currencies, Categories, Transactions, Alert Rules, Webhook Config</p>
        </div>
        <div class="form-group">
          <label>Select JSON File</label>
          <input type="file" @change="handleFileSelect" accept=".json" />
        </div>
        <div class="form-group">
          <label>Account Balance Merge Strategy</label>
          <select v-model="mergeStrategy" class="form-control">
            <option value="max">Use Maximum (Keep higher balance)</option>
            <option value="add">Add Balances (Sum existing + imported)</option>
            <option value="replace">Replace (Use imported balance)</option>
            <option value="skip">Skip (Keep existing balance unchanged)</option>
          </select>
          <small>When an account already exists, choose how to handle the balance.</small>
        </div>
        <button @click="importData" class="btn btn-primary" :disabled="!importFile || importLoading">
          {{ importLoading ? 'Importing...' : 'Import Data' }}
        </button>
        <div v-if="importResults" class="import-results">
          <h3>✅ Import Results</h3>
          <div class="results-summary">
            <div class="summary-card success">
              <div class="summary-label">Created</div>
              <div class="summary-value">{{ totalCreated }}</div>
            </div>
            <div class="summary-card info">
              <div class="summary-label">Updated</div>
              <div class="summary-value">{{ totalUpdated }}</div>
            </div>
            <div class="summary-card warning">
              <div class="summary-label">Skipped</div>
              <div class="summary-value">{{ totalSkipped }}</div>
            </div>
            <div class="summary-card error" v-if="totalErrors > 0">
              <div class="summary-label">Errors</div>
              <div class="summary-value">{{ totalErrors }}</div>
            </div>
          </div>
          
          <div class="results-details">
            <div v-for="(result, entityType) in importResults.results" :key="entityType" class="result-section">
              <h4>{{ entityType.charAt(0).toUpperCase() + entityType.slice(1) }}</h4>
              <div class="result-stats">
                <span class="stat-badge created">Created: {{ result.created || 0 }}</span>
                <span class="stat-badge updated">Updated: {{ result.updated || 0 }}</span>
                <span class="stat-badge skipped">Skipped: {{ result.skipped || 0 }}</span>
                <span v-if="result.errors && result.errors.length > 0" class="stat-badge error">
                  Errors: {{ result.errors.length }}
                </span>
              </div>
              <div v-if="result.errors && result.errors.length > 0" class="error-list">
                <details>
                  <summary>View Errors ({{ result.errors.length }})</summary>
                  <ul>
                    <li v-for="(error, idx) in result.errors" :key="idx">
                      <strong>{{ error.name || error.code || 'Unknown' }}:</strong> {{ error.error }}
                    </li>
                  </ul>
                </details>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Discord Webhook Section -->
      <div class="card">
        <h2>🔔 Discord Webhook Alerts</h2>
        <div class="info-box">
          <strong>ℹ️ About Discord Webhooks</strong>
          <p>Configure Discord webhooks to receive real-time alerts when transactions trigger your alert rules.</p>
        </div>
        <div v-if="webhookMessage" :class="webhookMessageType" style="margin-bottom: 16px;">
          {{ webhookMessage }}
        </div>
        <form @submit.prevent="saveWebhook">
          <div class="form-group">
            <label>Discord Webhook URL</label>
            <input v-model="webhookForm.webhookUrl" type="url" placeholder="https://discord.com/api/webhooks/..." />
            <small>Enter your Discord webhook URL to receive alerts</small>
          </div>
          <div class="form-group">
            <label>
              <input v-model="webhookForm.isEnabled" type="checkbox" />
              Enable webhook alerts
            </label>
          </div>
          <div class="form-group">
            <button type="submit" class="btn btn-primary" :disabled="webhookLoading">
              {{ webhookLoading ? 'Saving...' : 'Save Webhook Configuration' }}
            </button>
            <button v-if="webhook" type="button" @click="testWebhook" class="btn btn-secondary" style="margin-left: 10px;" :disabled="webhookLoading">
              🧪 Test Webhook
            </button>
            <button v-if="webhook" type="button" @click="deleteWebhook" class="btn btn-danger" style="margin-left: 10px;" :disabled="webhookLoading">
              Delete Webhook
            </button>
          </div>
        </form>
      </div>

      <!-- Alert Rules Section -->
      <div class="card">
        <h2>🚨 Alert Rules</h2>
        <div class="alert-rules-header">
          <p>Manage alert rules that trigger notifications when certain conditions are met.</p>
          <button @click="showAlertRuleModal = true" class="btn btn-primary">Add Alert Rule</button>
        </div>
        <div v-if="alertRulesLoading" class="loading">Loading alert rules...</div>
        <div v-else-if="alertRules.length === 0" class="empty-state">
          <p>No alert rules configured. Create one to get started.</p>
        </div>
        <div v-else class="alert-rules-list">
          <div v-for="rule in alertRules" :key="rule.id" class="alert-rule-item">
            <div class="rule-info">
              <h4>{{ rule.name }}</h4>
              <p>Type: {{ rule.ruleType }} | Threshold: {{ rule.threshold }} {{ rule.currency }}</p>
              <span :class="rule.isEnabled ? 'badge badge-success' : 'badge badge-secondary'">
                {{ rule.isEnabled ? 'Enabled' : 'Disabled' }}
              </span>
            </div>
            <div class="rule-actions">
              <button @click="editAlertRule(rule)" class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px;">Edit</button>
              <button @click="deleteAlertRule(rule.id)" class="btn btn-danger" style="padding: 4px 8px; font-size: 12px; margin-left: 4px;">Delete</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Alert Rule Modal -->
      <AlertRuleModal
        v-if="showAlertRuleModal || editingAlertRule"
        :rule="editingAlertRule"
        :accounts="accounts"
        :categories="categories"
        @close="closeAlertRuleModal"
        @saved="handleAlertRuleSaved"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { settingsService } from '../services/settingsService'
import { exportService } from '../services/exportService'
import { alertRuleService } from '../services/alertRuleService'
import { accountService } from '../services/accountService'
import { categoryService } from '../services/categoryService'
import AlertRuleModal from '../components/AlertRuleModal.vue'

const authStore = useAuthStore()

// Profile
const profileForm = ref({ username: '', email: '' })
const profileLoading = ref(false)
const profileMessage = ref('')
const profileMessageType = ref('')

// Password
const passwordForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' })
const passwordLoading = ref(false)
const passwordMessage = ref('')
const passwordMessageType = ref('')

// Export/Import
const exportLoading = ref(false)
const importFile = ref(null)
const importLoading = ref(false)
const importResults = ref(null)
const mergeStrategy = ref('max')

// Webhook
const webhook = ref(null)
const webhookForm = ref({ webhookUrl: '', isEnabled: false })
const webhookLoading = ref(false)
const webhookMessage = ref('')
const webhookMessageType = ref('')

// Alert Rules
const alertRules = ref([])
const alertRulesLoading = ref(false)
const showAlertRuleModal = ref(false)
const editingAlertRule = ref(null)
const accounts = ref([])
const categories = ref([])

const loadProfile = async () => {
  try {
    await authStore.checkAuth()
    if (authStore.user) {
      profileForm.value = {
        username: authStore.user.username || '',
        email: authStore.user.email || ''
      }
    }
  } catch (err) {
    console.error('Failed to load profile:', err)
  }
}

const saveProfile = async () => {
  profileLoading.value = true
  profileMessage.value = ''
  
  try {
    await settingsService.updateProfile(profileForm.value)
    profileMessage.value = 'Profile updated successfully'
    profileMessageType.value = 'success'
    await authStore.checkAuth()
  } catch (err) {
    profileMessage.value = err.response?.data?.error || 'Failed to update profile'
    profileMessageType.value = 'error'
  } finally {
    profileLoading.value = false
  }
}

const changePassword = async () => {
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    passwordMessage.value = 'New passwords do not match'
    passwordMessageType.value = 'error'
    return
  }
  
  passwordLoading.value = true
  passwordMessage.value = ''
  
  try {
    await settingsService.changePassword(
      passwordForm.value.oldPassword,
      passwordForm.value.newPassword
    )
    passwordMessage.value = 'Password changed successfully'
    passwordMessageType.value = 'success'
    passwordForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
  } catch (err) {
    passwordMessage.value = err.response?.data?.error || 'Failed to change password'
    passwordMessageType.value = 'error'
  } finally {
    passwordLoading.value = false
  }
}

const exportData = async (type, format = 'json') => {
  exportLoading.value = true
  try {
    let data
    let filename
    
    switch (type) {
      case 'transactions':
        data = await exportService.exportTransactions(format)
        filename = `transactions_${new Date().toISOString().split('T')[0]}.${format}`
        break
      case 'accounts':
        data = await exportService.exportAccounts()
        filename = `accounts_${new Date().toISOString().split('T')[0]}.json`
        const accountsText = await data.text()
        const accountsJson = JSON.parse(accountsText)
        const accountsBlob = new Blob([JSON.stringify(accountsJson, null, 2)], { type: 'application/json' })
        exportService.downloadFile(accountsBlob, filename)
        return
      case 'categories':
        data = await exportService.exportCategories()
        filename = `categories_${new Date().toISOString().split('T')[0]}.json`
        const categoriesText = await data.text()
        const categoriesJson = JSON.parse(categoriesText)
        const categoriesBlob = new Blob([JSON.stringify(categoriesJson, null, 2)], { type: 'application/json' })
        exportService.downloadFile(categoriesBlob, filename)
        return
      case 'currencies':
        data = await exportService.exportCurrencies()
        filename = `currencies_${new Date().toISOString().split('T')[0]}.json`
        const currenciesText = await data.text()
        const currenciesJson = JSON.parse(currenciesText)
        const currenciesBlob = new Blob([JSON.stringify(currenciesJson, null, 2)], { type: 'application/json' })
        exportService.downloadFile(currenciesBlob, filename)
        return
      case 'all':
        data = await exportService.exportAll()
        filename = `complete_export_${new Date().toISOString().split('T')[0]}.json`
        const allText = await data.text()
        const allJson = JSON.parse(allText)
        const allBlob = new Blob([JSON.stringify(allJson, null, 2)], { type: 'application/json' })
        exportService.downloadFile(allBlob, filename)
        return
    }
    
    if (format === 'csv') {
      // CSV is already a blob from the server
      exportService.downloadFile(data, filename, 'text/csv')
    } else {
      // For JSON transactions, convert blob to text then back to blob for proper formatting
      const text = await data.text()
      const jsonData = JSON.parse(text)
      const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' })
      exportService.downloadFile(blob, filename, 'application/json')
    }
  } catch (err) {
    alert(err.response?.data?.error || 'Failed to export data')
  } finally {
    exportLoading.value = false
  }
}

const handleFileSelect = (event) => {
  importFile.value = event.target.files[0]
}

const importData = async () => {
  if (!importFile.value) return
  
  importLoading.value = true
  importResults.value = null
  
  try {
    const text = await importFile.value.text()
    const data = JSON.parse(text)
    
    const result = await exportService.importData(data.data || data, {
      mergeStrategy: mergeStrategy.value
    })
    importResults.value = result
  } catch (err) {
    alert(err.response?.data?.error || 'Failed to import data')
  } finally {
    importLoading.value = false
  }
}

// Computed properties for import results summary
const totalCreated = computed(() => {
  if (!importResults.value?.results) return 0
  return Object.values(importResults.value.results).reduce((sum, r) => sum + (r.created || 0), 0)
})

const totalUpdated = computed(() => {
  if (!importResults.value?.results) return 0
  return Object.values(importResults.value.results).reduce((sum, r) => sum + (r.updated || 0), 0)
})

const totalSkipped = computed(() => {
  if (!importResults.value?.results) return 0
  return Object.values(importResults.value.results).reduce((sum, r) => sum + (r.skipped || 0), 0)
})

const totalErrors = computed(() => {
  if (!importResults.value?.results) return 0
  return Object.values(importResults.value.results).reduce((sum, r) => sum + (r.errors?.length || 0), 0)
})

const loadWebhook = async () => {
  try {
    const data = await settingsService.getWebhook()
    webhook.value = data.webhook
    if (data.webhook) {
      webhookForm.value = {
        webhookUrl: data.webhook.webhookUrl || '',
        isEnabled: data.webhook.isEnabled || false
      }
    }
  } catch (err) {
    console.error('Failed to load webhook:', err)
  }
}

const saveWebhook = async () => {
  webhookLoading.value = true
  webhookMessage.value = ''
  
  try {
    const data = await settingsService.saveWebhook(
      webhookForm.value.webhookUrl,
      webhookForm.value.isEnabled
    )
    webhook.value = data.webhook
    webhookMessage.value = 'Webhook saved successfully'
    webhookMessageType.value = 'success'
  } catch (err) {
    webhookMessage.value = err.response?.data?.error || 'Failed to save webhook'
    webhookMessageType.value = 'error'
  } finally {
    webhookLoading.value = false
  }
}

const testWebhook = async () => {
  webhookLoading.value = true
  try {
    await settingsService.testWebhook()
    webhookMessage.value = 'Test webhook sent successfully'
    webhookMessageType.value = 'success'
  } catch (err) {
    webhookMessage.value = err.response?.data?.error || 'Failed to test webhook'
    webhookMessageType.value = 'error'
  } finally {
    webhookLoading.value = false
  }
}

const deleteWebhook = async () => {
  if (!confirm('Are you sure you want to delete the webhook?')) return
  
  webhookLoading.value = true
  try {
    await settingsService.deleteWebhook()
    webhook.value = null
    webhookForm.value = { webhookUrl: '', isEnabled: false }
    webhookMessage.value = 'Webhook deleted successfully'
    webhookMessageType.value = 'success'
  } catch (err) {
    webhookMessage.value = err.response?.data?.error || 'Failed to delete webhook'
    webhookMessageType.value = 'error'
  } finally {
    webhookLoading.value = false
  }
}

const loadAlertRules = async () => {
  alertRulesLoading.value = true
  try {
    const data = await alertRuleService.getAlertRules()
    alertRules.value = data.rules || data
  } catch (err) {
    console.error('Failed to load alert rules:', err)
  } finally {
    alertRulesLoading.value = false
  }
}

const loadAccountsAndCategories = async () => {
  try {
    const [accountsData, categoriesData] = await Promise.all([
      accountService.getAccounts(),
      categoryService.getCategories()
    ])
    accounts.value = accountsData.accounts || accountsData
    categories.value = categoriesData.categories || categoriesData
  } catch (err) {
    console.error('Failed to load accounts/categories:', err)
  }
}

const editAlertRule = (rule) => {
  editingAlertRule.value = rule
}

const deleteAlertRule = async (id) => {
  if (!confirm('Are you sure you want to delete this alert rule?')) return
  
  try {
    await alertRuleService.deleteAlertRule(id)
    loadAlertRules()
  } catch (err) {
    alert(err.response?.data?.error || 'Failed to delete alert rule')
  }
}

const closeAlertRuleModal = () => {
  showAlertRuleModal.value = false
  editingAlertRule.value = null
}

const handleAlertRuleSaved = () => {
  closeAlertRuleModal()
  loadAlertRules()
}

onMounted(() => {
  loadProfile()
  loadWebhook()
  loadAlertRules()
  loadAccountsAndCategories()
})
</script>

<style scoped>
.info-box {
  background: #e3f2fd;
  border-left: 5px solid #2196f3;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 20px;
}

.info-box strong {
  color: #1976d2;
  display: block;
  margin-bottom: 8px;
}

.info-box p {
  color: #555;
  margin: 0;
  font-size: 14px;
}

.export-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
  margin-top: 20px;
}

.export-card {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #ddd;
}

.export-card h3 {
  margin: 0 0 8px 0;
  color: #333;
  font-size: 16px;
}

.export-card p {
  margin: 0 0 12px 0;
  color: #666;
  font-size: 14px;
}

.btn-export {
  width: 100%;
  background: #28a745;
  color: white;
}

.btn-export:hover {
  background: #218838;
}

.import-results {
  margin-top: 20px;
  padding: 20px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.import-results h3 {
  margin: 0 0 20px 0;
  color: var(--text-primary);
}

.results-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.summary-card {
  padding: 16px;
  border-radius: 8px;
  text-align: center;
  border: 1px solid var(--border-color);
}

.summary-card.success {
  background: var(--success-bg);
  border-color: var(--success-text);
}

.summary-card.info {
  background: #e3f2fd;
  border-color: #2196f3;
}

[data-theme="dark"] .summary-card.info {
  background: rgba(33, 150, 243, 0.1);
  border-color: #58a6ff;
}

.summary-card.warning {
  background: var(--warning-bg);
  border-color: var(--warning-text);
}

.summary-card.error {
  background: var(--error-bg);
  border-color: var(--error-text);
}

.summary-label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
  color: var(--text-secondary);
}

.summary-value {
  font-size: 28px;
  font-weight: bold;
  color: var(--text-primary);
}

.results-details {
  margin-top: 24px;
}

.result-section {
  margin-bottom: 20px;
  padding: 16px;
  background: var(--card-bg);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.result-section h4 {
  margin: 0 0 12px 0;
  color: var(--text-primary);
  text-transform: capitalize;
}

.result-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.stat-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.stat-badge.created {
  background: var(--success-bg);
  color: var(--success-text);
}

.stat-badge.updated {
  background: #e3f2fd;
  color: #1976d2;
}

[data-theme="dark"] .stat-badge.updated {
  background: rgba(88, 166, 255, 0.2);
  color: #58a6ff;
}

.stat-badge.skipped {
  background: var(--warning-bg);
  color: var(--warning-text);
}

.stat-badge.error {
  background: var(--error-bg);
  color: var(--error-text);
}

.error-list {
  margin-top: 12px;
}

.error-list details {
  cursor: pointer;
}

.error-list summary {
  padding: 8px;
  background: var(--error-bg);
  border-radius: 4px;
  color: var(--error-text);
  font-weight: 600;
  margin-bottom: 8px;
}

.error-list ul {
  margin: 8px 0 0 0;
  padding-left: 24px;
}

.error-list li {
  margin-bottom: 8px;
  color: var(--error-text);
  font-size: 14px;
}

.form-control {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--input-border);
  border-radius: 6px;
  font-size: 14px;
  background: var(--input-bg);
  color: var(--text-primary);
  transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
}

.form-control:focus {
  outline: none;
  border-color: var(--focus-color);
  box-shadow: 0 0 0 3px var(--focus-shadow);
}

.alert-rules-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.alert-rules-list {
  display: grid;
  gap: 16px;
}

.alert-rule-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #ddd;
}

.rule-info h4 {
  margin: 0 0 8px 0;
  color: #333;
}

.rule-info p {
  margin: 0 0 8px 0;
  color: #666;
  font-size: 14px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #666;
}
</style>

<template>
  <div class="audit">
    <div class="container">
      <div class="audit-header">
        <div>
          <h1>📋 Audit Trail</h1>
          <p class="subtitle">View all system activity and changes</p>
        </div>
        <button 
          @click="confirmClearAuditTrail" 
          class="btn btn-danger"
          :disabled="clearingAudit"
        >
          {{ clearingAudit ? 'Clearing...' : '🗑️ Clear Audit Trail' }}
        </button>
      </div>

      <!-- Filters -->
      <div class="card">
        <div class="filters">
          <div class="form-group">
            <label>Action</label>
            <select v-model="filters.action" @change="loadLogs">
              <option value="">All Actions</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="WEB_LOGIN">Web Login</option>
              <option value="API_LOGIN">API Login</option>
              <option value="API_REQUEST">API Request</option>
              <option value="API_GET">API GET</option>
              <option value="API_POST">API POST</option>
              <option value="API_PUT">API PUT</option>
              <option value="API_DELETE">API DELETE</option>
              <option value="API_ERROR">API Error</option>
              <option value="API_ERROR_CLIENT">API Client Error</option>
            </select>
          </div>
          <div class="form-group">
            <label>Entity Type</label>
            <select v-model="filters.entityType" @change="loadLogs">
              <option value="">All Types</option>
              <option value="Account">Account</option>
              <option value="Category">Category</option>
              <option value="Transaction">Transaction</option>
              <option value="Transfer">Transfer</option>
              <option value="Currency">Currency</option>
              <option value="User">User</option>
              <option value="API">API</option>
              <option value="Error">Error</option>
            </select>
          </div>
          <div class="form-group">
            <label>Start Date</label>
            <input v-model="filters.startDate" type="date" @change="loadLogs" />
          </div>
          <div class="form-group">
            <label>End Date</label>
            <input v-model="filters.endDate" type="date" @change="loadLogs" />
          </div>
          <div class="form-group">
            <label>Limit</label>
            <select v-model="filters.limit" @change="loadLogs">
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
            </select>
          </div>
          <div class="filter-actions">
            <button @click="loadLogs" class="btn btn-primary">🔍 Apply Filters</button>
            <button @click="clearFilters" class="btn btn-secondary">❌ Clear</button>
          </div>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-grid" v-if="stats">
        <div class="stat-card">
          <div class="stat-label">Total Logs</div>
          <div class="stat-value">{{ stats.total || 0 }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Filtered Results</div>
          <div class="stat-value">{{ stats.filtered || logs.length }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Server Errors</div>
          <div class="stat-value error-count">{{ stats.errors || 0 }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Current Page</div>
          <div class="stat-value">{{ currentPage }}</div>
        </div>
      </div>

      <!-- Audit Logs Table -->
      <div class="card">
        <div v-if="loading" class="loading">Loading audit logs...</div>
        <div v-else-if="error" class="error">{{ error }}</div>
        <div v-else-if="logs.length === 0" class="empty-state">
          No audit logs found matching your filters.
        </div>
        <div v-else>
          <table class="audit-table">
            <thead>
              <tr>
                <th @click="sortBy('createdAt')" :class="getSortClass('createdAt')">
                  Date & Time
                  <span v-if="sortColumn === 'createdAt'" class="sort-indicator">
                    {{ sortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
                <th @click="sortBy('action')" :class="getSortClass('action')">
                  Action
                  <span v-if="sortColumn === 'action'" class="sort-indicator">
                    {{ sortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
                <th @click="sortBy('entityType')" :class="getSortClass('entityType')">
                  Entity Type
                  <span v-if="sortColumn === 'entityType'" class="sort-indicator">
                    {{ sortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
                <th @click="sortBy('entityId')" :class="getSortClass('entityId')">
                  Entity ID
                  <span v-if="sortColumn === 'entityId'" class="sort-indicator">
                    {{ sortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
                <th @click="sortBy('description')" :class="getSortClass('description')">
                  Description
                  <span v-if="sortColumn === 'description'" class="sort-indicator">
                    {{ sortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
                <th @click="sortBy('ipAddress')" :class="getSortClass('ipAddress')">
                  IP Address
                  <span v-if="sortColumn === 'ipAddress'" class="sort-indicator">
                    {{ sortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(log, index) in sortedLogs" :key="log.id">
                <td>{{ formatDate(log.createdAt) }}</td>
                <td>
                  <span class="badge" :class="`badge-${getActionClass(log.action)}`">
                    {{ log.action }}
                  </span>
                </td>
                <td>
                  <span class="entity-type-badge">{{ log.entityType || 'N/A' }}</span>
                </td>
                <td>{{ log.entityId || 'N/A' }}</td>
                <td>{{ log.description || '-' }}</td>
                <td>
                  <span class="ip-address">{{ log.ipAddress || '-' }}</span>
                </td>
                <td>
                  <button @click="openModal(index)" class="btn-details">View Details</button>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Pagination -->
          <div class="pagination" v-if="stats && stats.total > parseInt(filters.limit)">
            <button 
              @click="previousPage" 
              :disabled="currentPage === 1"
              class="btn btn-secondary"
            >
              ← Previous
            </button>
            <span class="page-info">Page {{ currentPage }} of {{ totalPages }}</span>
            <button 
              @click="nextPage" 
              :disabled="currentPage >= totalPages"
              class="btn btn-secondary"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Details Modal -->
    <div v-if="showModal && selectedLog" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Audit Log Details</h2>
          <button @click="closeModal" class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <!-- Basic Information -->
          <div class="modal-section">
            <div class="modal-section-title">Basic Information</div>
            <div class="modal-info-grid">
              <div class="modal-info-label">Date & Time:</div>
              <div class="modal-info-value">{{ formatDateTime(selectedLog.createdAt) }}</div>
              
              <div class="modal-info-label">Action:</div>
              <div class="modal-info-value">
                <span class="badge" :class="`badge-${getActionClass(selectedLog.action)}`">
                  {{ selectedLog.action }}
                </span>
              </div>
              
              <div class="modal-info-label">Entity Type:</div>
              <div class="modal-info-value">
                <span class="entity-type-badge">{{ selectedLog.entityType || 'N/A' }}</span>
              </div>
              
              <div class="modal-info-label">Entity ID:</div>
              <div class="modal-info-value">{{ selectedLog.entityId || 'N/A' }}</div>
              
              <div class="modal-info-label">Description:</div>
              <div class="modal-info-value">{{ selectedLog.description || 'N/A' }}</div>
              
              <div class="modal-info-label">IP Address:</div>
              <div class="modal-info-value">
                <span class="ip-address">{{ selectedLog.ipAddress || 'N/A' }}</span>
              </div>
              
              <div v-if="selectedLog.user" class="modal-info-label">User:</div>
              <div v-if="selectedLog.user" class="modal-info-value">
                {{ selectedLog.user.username || selectedLog.user.email || 'N/A' }}
              </div>
            </div>
          </div>

          <!-- Old Values -->
          <div v-if="selectedLog.oldValues" class="modal-section">
            <div class="modal-section-title">📋 Old Values</div>
            <div class="details-section">
              <pre class="json-view">{{ JSON.stringify(selectedLog.oldValues, null, 2) }}</pre>
            </div>
          </div>

          <!-- New Values -->
          <div v-if="selectedLog.newValues" class="modal-section">
            <div class="modal-section-title">✨ New Values</div>
            <div class="details-section">
              <pre class="json-view">{{ JSON.stringify(selectedLog.newValues, null, 2) }}</pre>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeModal" class="btn btn-primary">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { auditService } from '../services/auditService'
import { format } from 'date-fns'

const logs = ref([])
const loading = ref(false)
const error = ref(null)
const stats = ref(null)
const showModal = ref(false)
const selectedLog = ref(null)
const currentPage = ref(1)
const sortColumn = ref('createdAt')
const sortDirection = ref('desc')
const clearingAudit = ref(false)

const filters = ref({
  action: '',
  entityType: '',
  startDate: '',
  endDate: '',
  limit: '100'
})

const formatDate = (date) => {
  if (!date) return '-'
  return format(new Date(date), 'MMM dd, yyyy HH:mm')
}

const formatDateTime = (date) => {
  if (!date) return '-'
  return format(new Date(date), 'MMM dd, yyyy HH:mm:ss')
}

const getActionClass = (action) => {
  if (!action) return 'default'
  const actionLower = action.toLowerCase()
  if (actionLower.includes('create')) return 'create'
  if (actionLower.includes('update')) return 'update'
  if (actionLower.includes('delete')) return 'delete'
  if (actionLower.includes('login')) return 'login'
  if (actionLower.includes('error')) return 'error'
  return 'default'
}

const getSortClass = (column) => {
  if (sortColumn.value === column) {
    return sortDirection.value === 'asc' ? 'sort-asc' : 'sort-desc'
  }
  return 'sortable'
}

const sortBy = (column) => {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortColumn.value = column
    sortDirection.value = 'asc'
  }
}

const sortedLogs = computed(() => {
  const sorted = [...logs.value]
  sorted.sort((a, b) => {
    let aVal = a[sortColumn.value]
    let bVal = b[sortColumn.value]
    
    // Handle null/undefined
    if (aVal == null) return 1
    if (bVal == null) return -1
    
    // Handle dates
    if (sortColumn.value === 'createdAt') {
      aVal = new Date(aVal).getTime()
      bVal = new Date(bVal).getTime()
    }
    
    // Handle strings
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase()
      bVal = bVal.toLowerCase()
    }
    
    if (sortDirection.value === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
    }
  })
  return sorted
})

const totalPages = computed(() => {
  if (!stats || !stats.total) return 1
  return Math.ceil(stats.total / parseInt(filters.value.limit))
})

const openModal = (index) => {
  selectedLog.value = sortedLogs.value[index]
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  selectedLog.value = null
}

const clearFilters = () => {
  filters.value = {
    action: '',
    entityType: '',
    startDate: '',
    endDate: '',
    limit: '100'
  }
  currentPage.value = 1
  loadLogs()
}

const previousPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    loadLogs()
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    loadLogs()
  }
}

const loadLogs = async () => {
  loading.value = true
  error.value = null
  
  try {
    const params = {
      limit: parseInt(filters.value.limit),
      offset: (currentPage.value - 1) * parseInt(filters.value.limit)
    }
    
    if (filters.value.action) params.action = filters.value.action
    if (filters.value.entityType) params.entityType = filters.value.entityType
    if (filters.value.startDate) params.startDate = filters.value.startDate
    if (filters.value.endDate) params.endDate = filters.value.endDate
    
    const data = await auditService.getAuditLogs(params)
    logs.value = data.logs || []
    stats.value = {
      total: data.total || logs.value.length,
      filtered: logs.value.length,
      errors: logs.value.filter(log => 
        log.action && (log.action.includes('ERROR') || log.entityType === 'Error')
      ).length
    }
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to load audit logs'
    console.error('Audit error:', err)
  } finally {
    loading.value = false
  }
}

const confirmClearAuditTrail = async () => {
  const confirmed = confirm(
    '⚠️ WARNING: This will permanently delete ALL audit logs. This action cannot be undone.\n\n' +
    'Are you sure you want to clear the entire audit trail?'
  )
  
  if (!confirmed) return
  
  clearingAudit.value = true
  error.value = null
  
  try {
    const result = await auditService.clearAuditTrail()
    alert(`✅ ${result.message || `Successfully deleted ${result.deletedCount || 0} audit log(s)`}`)
    
    // Reload logs (should be empty now)
    await loadLogs()
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to clear audit trail'
    alert(`❌ Error: ${error.value}`)
  } finally {
    clearingAudit.value = false
  }
}

onMounted(() => {
  loadLogs()
})
</script>

<style scoped>
.audit-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  gap: 20px;
}

.audit-header h1 {
  margin: 0 0 8px 0;
  color: var(--text-primary);
}

.subtitle {
  color: var(--text-secondary);
  margin: 0;
}

.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  align-items: end;
}

.filter-actions {
  display: flex;
  gap: 8px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--card-bg);
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px var(--shadow);
  border: 1px solid var(--border-color);
}

.stat-label {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: var(--text-primary);
}

.error-count {
  color: #ff5252;
}

.audit-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 16px;
}

.audit-table th {
  text-align: left;
  padding: 12px;
  border-bottom: 2px solid var(--border-color);
  font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
  user-select: none;
  position: relative;
}

.audit-table th.sortable:hover {
  background: var(--bg-tertiary);
}

.sort-indicator {
  margin-left: 8px;
  font-size: 12px;
  color: #667eea;
}

.audit-table td {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
  font-size: 14px;
  color: var(--text-primary);
}

.audit-table tr:hover {
  background-color: var(--bg-tertiary);
}

.badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  display: inline-block;
}

.badge-create {
  background: #d4edda;
  color: #155724;
}

.badge-update {
  background: #d1ecf1;
  color: #0c5460;
}

.badge-delete {
  background: #f8d7da;
  color: #721c24;
}

.badge-login {
  background: var(--warning-bg);
  color: #856404;
}

.badge-error {
  background: #f8d7da;
  color: #c62828;
}

.badge-default {
  background: #e9ecef;
  color: #495057;
}

.entity-type-badge {
  padding: 4px 8px;
  background: #e3f2fd;
  color: #1976d2;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.ip-address {
  font-family: monospace;
  font-size: 12px;
  color: var(--text-secondary);
}

.btn-details {
  padding: 6px 12px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: background 0.2s;
}

.btn-details:hover {
  background: #5568d3;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color);
}

.page-info {
  color: var(--text-secondary);
  font-weight: 600;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
}

/* Modal Styles */
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
  padding: 20px;
}

.modal-content {
  background: var(--card-bg);
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h2 {
  margin: 0;
  color: var(--text-primary);
}

.modal-close {
  background: none;
  border: none;
  font-size: 32px;
  cursor: pointer;
  color: var(--text-secondary);
  line-height: 1;
  padding: 0;
  width: 32px;
  height: 32px;
}

.modal-close:hover {
  color: var(--text-primary);
}

.modal-body {
  padding: 24px;
}

.modal-section {
  margin-bottom: 24px;
}

.modal-section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--border-color);
}

.modal-info-grid {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 12px;
}

.modal-info-label {
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 14px;
}

.modal-info-value {
  color: var(--text-primary);
  font-size: 14px;
}

.details-section {
  background: var(--bg-tertiary);
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.json-view {
  margin: 0;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-x: auto;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
}
</style>

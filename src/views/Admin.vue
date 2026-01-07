<template>
  <div class="admin">
    <div class="container">
      <div class="page-header">
        <h1>User Management</h1>
        <button @click="showAddModal = true" class="btn btn-primary">Add User</button>
      </div>

      <div v-if="loading" class="loading">Loading users...</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      
      <div v-else class="users-table">
        <table class="card">
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Email</th>
              <th>Web Access</th>
              <th>Allowed IPs</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td>{{ user.id }}</td>
              <td>{{ user.username }}</td>
              <td>{{ user.email }}</td>
              <td>
                <span :class="user.canAccessWeb ? 'badge badge-success' : 'badge badge-secondary'">
                  {{ user.canAccessWeb ? 'Yes' : 'No' }}
                </span>
              </td>
              <td>{{ user.allowedIps || '-' }}</td>
              <td>
                <button @click="editUser(user)" class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px;">Edit</button>
                <button @click="deleteUser(user.id)" class="btn btn-danger" style="padding: 4px 8px; font-size: 12px; margin-left: 4px;">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Add/Edit Modal -->
      <UserModal
        v-if="showAddModal || editingUser"
        :user="editingUser"
        @close="closeModal"
        @saved="handleUserSaved"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { adminService } from '../services/adminService'
import UserModal from '../components/UserModal.vue'

const users = ref([])
const loading = ref(false)
const error = ref(null)
const showAddModal = ref(false)
const editingUser = ref(null)

const loadUsers = async () => {
  loading.value = true
  error.value = null
  
  try {
    const data = await adminService.getUsers()
    users.value = data.users || data
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to load users'
    console.error('Users error:', err)
  } finally {
    loading.value = false
  }
}

const editUser = (user) => {
  editingUser.value = user
}

const deleteUser = async (id) => {
  if (!confirm('Are you sure you want to delete this user?')) return
  
  try {
    await adminService.deleteUser(id)
    loadUsers()
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to delete user'
  }
}

const closeModal = () => {
  showAddModal.value = false
  editingUser.value = null
}

const handleUserSaved = () => {
  closeModal()
  loadUsers()
}

onMounted(() => {
  loadUsers()
})
</script>

<style scoped>
.users-table {
  margin-top: 24px;
}

.users-table table {
  width: 100%;
  border-collapse: collapse;
}

.users-table th {
  text-align: left;
  padding: 12px;
  border-bottom: 2px solid #ddd;
  font-weight: 600;
  color: #666;
}

.users-table td {
  padding: 12px;
  border-bottom: 1px solid #eee;
}

.badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.badge-success {
  background: #d4edda;
  color: #155724;
}

.badge-secondary {
  background: #e2e3e5;
  color: #383d41;
}
</style>


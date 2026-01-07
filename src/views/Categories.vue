<template>
  <div class="categories">
    <div class="container">
      <div class="page-header">
        <h1>📂 Categories</h1>
        <button @click="showAddModal = true" class="btn btn-primary">+ Add Category</button>
      </div>

      <div class="card">
        <div class="filters">
          <div class="form-group" style="width: 200px;">
            <label>Filter by Type</label>
            <select v-model="typeFilter" @change="loadCategories">
              <option value="">All Types</option>
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
            </select>
          </div>
        </div>
      </div>

      <div v-if="loading" class="loading">Loading categories...</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      
      <div v-else>
        <!-- Cards View -->
        <div class="categories-cards-section">
          <h2>Category Cards</h2>
          <div class="categories-grid">
            <div 
              v-for="category in categories" 
              :key="category.id" 
              class="category-card"
              :class="`type-${category.type.toLowerCase()}`"
              @click="editCategory(category)"
            >
              <div class="category-card-header">
                <div class="category-icon">
                  {{ category.type === 'Income' ? '💰' : '💸' }}
                </div>
                <div class="category-actions-card">
                  <button 
                    @click.stop="editCategory(category)" 
                    class="icon-btn edit-btn"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button 
                    @click.stop="deleteCategory(category.id)" 
                    class="icon-btn delete-btn"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <div class="category-card-body">
                <h3 class="category-name">{{ category.name }}</h3>
                <div class="category-type-badge" :class="`badge-${category.type.toLowerCase()}`">
                  {{ category.type }}
                </div>
                <div v-if="category.subcategory" class="category-subcategory">
                  Subcategory: {{ category.subcategory }}
                </div>
                <div v-if="category.excludeFromReports" class="category-excluded">
                  ⚠️ Excluded from reports
                </div>
              </div>
            </div>
            
            <!-- Add New Card -->
            <div class="category-card add-card" @click="showAddModal = true">
              <div class="add-card-content">
                <div class="add-icon">+</div>
                <div class="add-text">Add New Category</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Table View -->
        <div class="categories-table-section">
          <h2>Categories Table</h2>
          <div class="card">
            <div class="table-controls">
              <div class="table-search">
                <input 
                  v-model="searchQuery" 
                  type="text" 
                  placeholder="🔍 Search categories..." 
                  class="search-input"
                />
              </div>
              <div class="view-toggle">
                <button 
                  @click="viewMode = 'cards'"
                  :class="['view-btn', { active: viewMode === 'cards' }]"
                >
                  📋 Cards
                </button>
                <button 
                  @click="viewMode = 'table'"
                  :class="['view-btn', { active: viewMode === 'table' }]"
                >
                  📊 Table
                </button>
              </div>
            </div>
            
            <div v-if="viewMode === 'table'">
              <table class="categories-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Subcategory</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr 
                    v-for="category in filteredCategories" 
                    :key="category.id"
                    :class="`type-${category.type.toLowerCase()}-row`"
                  >
                    <td>
                      <div class="table-category-name">
                        <span class="category-icon-small">
                          {{ category.type === 'Income' ? '💰' : '💸' }}
                        </span>
                        <strong>{{ category.name }}</strong>
                      </div>
                    </td>
                    <td>
                      <span class="category-type-badge-table" :class="`badge-${category.type.toLowerCase()}`">
                        {{ category.type }}
                      </span>
                    </td>
                    <td>
                      <span class="subcategory-text">{{ category.subcategory || '-' }}</span>
                    </td>
                    <td>
                      <span v-if="category.excludeFromReports" class="badge badge-excluded">
                        Excluded
                      </span>
                      <span v-else class="badge badge-included">Included</span>
                    </td>
                    <td>
                      <div class="table-actions">
                        <button @click="editCategory(category)" class="btn-icon" title="Edit">
                          ✏️
                        </button>
                        <button @click="deleteCategory(category.id)" class="btn-icon danger" title="Delete">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Add/Edit Modal -->
      <CategoryModal
        v-if="showAddModal || editingCategory"
        :category="editingCategory"
        @close="closeModal"
        @saved="handleCategorySaved"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { categoryService } from '../services/categoryService'
import CategoryModal from '../components/CategoryModal.vue'

const categories = ref([])
const loading = ref(false)
const error = ref(null)
const showAddModal = ref(false)
const editingCategory = ref(null)
const typeFilter = ref('')
const searchQuery = ref('')
const viewMode = ref('cards')

const filteredCategories = computed(() => {
  let filtered = categories.value
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(category => 
      category.name.toLowerCase().includes(query) ||
      (category.subcategory && category.subcategory.toLowerCase().includes(query))
    )
  }
  return filtered
})

const loadCategories = async () => {
  loading.value = true
  error.value = null
  
  try {
    const data = await categoryService.getCategories(typeFilter.value || null)
    categories.value = data.categories || data
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to load categories'
    console.error('Categories error:', err)
  } finally {
    loading.value = false
  }
}

const editCategory = (category) => {
  editingCategory.value = category
}

const deleteCategory = async (id) => {
  if (!confirm('Are you sure you want to delete this category?')) return
  
  try {
    await categoryService.deleteCategory(id)
    loadCategories()
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to delete category'
  }
}

const closeModal = () => {
  showAddModal.value = false
  editingCategory.value = null
}

const handleCategorySaved = () => {
  closeModal()
  loadCategories()
}

onMounted(() => {
  loadCategories()
})
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0;
  color: var(--text-primary);
}

.filters {
  display: flex;
  gap: 16px;
  margin-bottom: 0;
}

/* Cards Section */
.categories-cards-section {
  margin-bottom: 40px;
}

.categories-cards-section h2 {
  margin-bottom: 20px;
  color: var(--text-primary);
  font-size: 20px;
}

.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.category-card {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px var(--shadow);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.category-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
}

.category-card.type-income::before {
  background: linear-gradient(90deg, #28a745, #20c997);
}

.category-card.type-expense::before {
  background: linear-gradient(90deg, #dc3545, #f5576c);
}

.category-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px var(--shadow);
}

.category-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.category-icon {
  font-size: 32px;
}

.category-actions-card {
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.category-card:hover .category-actions-card {
  opacity: 1;
}

.icon-btn {
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.icon-btn:hover {
  transform: scale(1.1);
}

.delete-btn:hover {
  background: #ffebee;
}

.edit-btn:hover {
  background: #e3f2fd;
}

.category-card-body {
  text-align: center;
}

.category-name {
  margin: 0 0 12px 0;
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 600;
}

.category-type-badge {
  display: inline-block;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.badge-income {
  background: #d4edda;
  color: #155724;
}

.badge-expense {
  background: #f8d7da;
  color: #721c24;
}

.category-subcategory {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 8px;
  padding: 8px;
  background: var(--bg-tertiary);
  border-radius: 6px;
}

.category-excluded {
  font-size: 12px;
  color: #ff9800;
  margin-top: 8px;
  font-weight: 600;
}

/* Add Card */
.add-card {
  border: 2px dashed var(--border-color);
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.add-card:hover {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.05);
}

.add-card-content {
  text-align: center;
}

.add-icon {
  font-size: 48px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.add-text {
  color: var(--text-secondary);
  font-weight: 600;
}

/* Table Section */
.categories-table-section {
  margin-top: 40px;
}

.categories-table-section h2 {
  margin-bottom: 20px;
  color: var(--text-primary);
  font-size: 20px;
}

.table-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  gap: 16px;
  flex-wrap: wrap;
}

.table-search {
  flex: 1;
  min-width: 200px;
}

.search-input {
  width: 100%;
  padding: 10px 16px;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 14px;
}

.view-toggle {
  display: flex;
  gap: 8px;
}

.view-btn {
  padding: 8px 16px;
  border: 2px solid var(--input-border);
  border-radius: 8px;
  background: var(--input-bg);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.view-btn:hover {
  border-color: #667eea;
}

.view-btn.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.categories-table {
  width: 100%;
  border-collapse: collapse;
}

.categories-table th {
  text-align: left;
  padding: 12px;
  border-bottom: 2px solid var(--border-color);
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.categories-table td {
  padding: 16px 12px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
}

.categories-table tr:hover {
  background: var(--bg-tertiary);
}

.categories-table tr.type-income-row {
  background: rgba(40, 167, 69, 0.05);
}

.categories-table tr.type-expense-row {
  background: rgba(220, 53, 69, 0.05);
}

.table-category-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.category-icon-small {
  font-size: 18px;
}

.category-type-badge-table {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.subcategory-text {
  font-size: 13px;
  color: var(--text-secondary);
}

.badge-excluded {
  background: var(--warning-bg);
  color: #856404;
}

.badge-included {
  background: #d4edda;
  color: #155724;
}

.table-actions {
  display: flex;
  gap: 8px;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: var(--bg-tertiary);
  transform: scale(1.1);
}

.btn-icon.danger:hover {
  background: #ffebee;
}
</style>

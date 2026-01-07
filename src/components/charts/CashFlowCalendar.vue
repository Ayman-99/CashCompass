<template>
  <div class="cashflow-calendar">
    <div class="calendar-header">
      <h3>Cash Flow Calendar</h3>
      <div class="calendar-controls">
        <button @click="viewMode = 'month'" :class="{ active: viewMode === 'month' }">Month</button>
        <button @click="viewMode = 'week'" :class="{ active: viewMode === 'week' }">Week</button>
      </div>
    </div>
    
    <div class="calendar-grid" v-if="viewMode === 'month'">
      <div class="calendar-day" 
           v-for="day in calendarDays" 
           :key="day.date"
           :class="{ 
             'has-income': day.income > 0,
             'has-expense': day.expense > 0,
             'positive': day.net > 0,
             'negative': day.net < 0
           }"
           @click="selectDay(day)"
      >
        <div class="day-header">
          <span class="day-number">{{ getDayNumber(day.date) }}</span>
          <span class="day-name">{{ getDayName(day.date) }}</span>
        </div>
        <div class="day-amounts">
          <span v-if="day.income > 0" class="income">+{{ formatCurrency(day.income) }}</span>
          <span v-if="day.expense > 0" class="expense">-{{ formatCurrency(day.expense) }}</span>
          <span class="net" :class="{ positive: day.net > 0, negative: day.net < 0 }">
            {{ formatCurrency(day.net) }}
          </span>
        </div>
        <div v-if="day.transactionCount > 0" class="transaction-count">
          {{ day.transactionCount }} {{ day.transactionCount === 1 ? 'transaction' : 'transactions' }}
        </div>
      </div>
    </div>
    
    <div class="week-view" v-else>
      <div class="week-day" 
           v-for="day in weekDays" 
           :key="day.date"
           :class="{ 
             'has-income': day.income > 0,
             'has-expense': day.expense > 0
           }"
      >
        <div class="week-day-header">
          <strong>{{ getDayName(day.date) }}</strong>
          <span class="day-date">{{ formatDate(day.date) }}</span>
        </div>
        <div class="week-day-amounts">
          <div class="amount-row">
            <span class="label">Income:</span>
            <span class="value income">{{ formatCurrency(day.income) }}</span>
          </div>
          <div class="amount-row">
            <span class="label">Expense:</span>
            <span class="value expense">{{ formatCurrency(day.expense) }}</span>
          </div>
          <div class="amount-row net-row">
            <span class="label">Net:</span>
            <span class="value net" :class="{ positive: day.net > 0, negative: day.net < 0 }">
              {{ formatCurrency(day.net) }}
            </span>
          </div>
        </div>
        <div v-if="day.transactions && day.transactions.length > 0" class="week-transactions">
          <div v-for="tx in day.transactions.slice(0, 3)" :key="tx.id" class="transaction-item">
            <span class="tx-description">{{ tx.description || 'No description' }}</span>
            <span class="tx-amount" :class="tx.type.toLowerCase()">
              {{ tx.type === 'Income' ? '+' : '-' }}{{ formatCurrency(Math.abs(tx.amount)) }}
            </span>
          </div>
          <div v-if="day.transactions.length > 3" class="more-transactions">
            +{{ day.transactions.length - 3 }} more
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="selectedDay" class="day-details">
      <h4>{{ formatDate(selectedDay.date) }}</h4>
      <div class="details-summary">
        <div class="detail-item">
          <span class="label">Income:</span>
          <span class="value income">{{ formatCurrency(selectedDay.income) }}</span>
        </div>
        <div class="detail-item">
          <span class="label">Expense:</span>
          <span class="value expense">{{ formatCurrency(selectedDay.expense) }}</span>
        </div>
        <div class="detail-item">
          <span class="label">Net:</span>
          <span class="value net" :class="{ positive: selectedDay.net > 0, negative: selectedDay.net < 0 }">
            {{ formatCurrency(selectedDay.net) }}
          </span>
        </div>
      </div>
      <div v-if="selectedDay.transactions && selectedDay.transactions.length > 0" class="details-transactions">
        <h5>Transactions ({{ selectedDay.transactions.length }})</h5>
        <div v-for="tx in selectedDay.transactions" :key="tx.id" class="transaction-detail">
          <div class="tx-info">
            <span class="tx-description">{{ tx.description || 'No description' }}</span>
            <span class="tx-category">{{ tx.category || 'Uncategorized' }}</span>
          </div>
          <span class="tx-amount" :class="tx.type.toLowerCase()">
            {{ tx.type === 'Income' ? '+' : '-' }}{{ formatCurrency(Math.abs(tx.amount)) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  }
})

const viewMode = ref('month')
const selectedDay = ref(null)

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0)
}

const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const getDayNumber = (dateString) => {
  const date = new Date(dateString)
  return date.getDate()
}

const getDayName = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { weekday: 'short' })
}

const calendarDays = computed(() => {
  if (!props.data || props.data.length === 0) return []
  return props.data
})

const weekDays = computed(() => {
  if (!props.data || props.data.length === 0) return []
  // Get last 7 days
  return props.data.slice(-7)
})

const selectDay = (day) => {
  selectedDay.value = day
}
</script>

<style scoped>
.cashflow-calendar {
  padding: 20px;
  background: var(--card-bg, #fff);
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.calendar-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary, #333);
}

.calendar-controls {
  display: flex;
  gap: 8px;
}

.calendar-controls button {
  padding: 6px 12px;
  border: 1px solid var(--input-border, #ddd);
  background: var(--input-bg, #f5f5f5);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.calendar-controls button.active {
  background: var(--primary-color, #667eea);
  color: white;
  border-color: var(--primary-color, #667eea);
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.calendar-day {
  min-height: 100px;
  padding: 8px;
  border: 1px solid var(--input-border, #ddd);
  border-radius: 6px;
  background: var(--input-bg, #f9f9f9);
  cursor: pointer;
  transition: all 0.2s;
}

.calendar-day:hover {
  border-color: var(--primary-color, #667eea);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.calendar-day.has-income {
  border-left: 3px solid #28a745;
}

.calendar-day.has-expense {
  border-right: 3px solid #dc3545;
}

.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.day-number {
  font-weight: bold;
  font-size: 16px;
  color: var(--text-primary, #333);
}

.day-name {
  font-size: 11px;
  color: var(--text-secondary, #666);
  text-transform: uppercase;
}

.day-amounts {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}

.day-amounts .income {
  color: #28a745;
  font-weight: 500;
}

.day-amounts .expense {
  color: #dc3545;
  font-weight: 500;
}

.day-amounts .net {
  font-weight: bold;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--input-border, #ddd);
}

.day-amounts .net.positive {
  color: #28a745;
}

.day-amounts .net.negative {
  color: #dc3545;
}

.transaction-count {
  font-size: 10px;
  color: var(--text-secondary, #666);
  margin-top: 4px;
}

.week-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.week-day {
  padding: 16px;
  border: 1px solid var(--input-border, #ddd);
  border-radius: 8px;
  background: var(--input-bg, #f9f9f9);
}

.week-day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--input-border, #ddd);
}

.day-date {
  font-size: 12px;
  color: var(--text-secondary, #666);
}

.week-day-amounts {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.amount-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.amount-row.net-row {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--input-border, #ddd);
  font-weight: bold;
}

.week-transactions {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--input-border, #ddd);
}

.transaction-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 13px;
}

.tx-description {
  color: var(--text-primary, #333);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tx-amount {
  font-weight: 500;
  margin-left: 12px;
}

.tx-amount.income {
  color: #28a745;
}

.tx-amount.expense {
  color: #dc3545;
}

.more-transactions {
  font-size: 11px;
  color: var(--text-secondary, #666);
  font-style: italic;
  margin-top: 4px;
}

.day-details {
  margin-top: 20px;
  padding: 16px;
  background: var(--input-bg, #f5f5f5);
  border-radius: 8px;
}

.day-details h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: var(--text-primary, #333);
}

.details-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background: white;
  border-radius: 4px;
}

.details-transactions h5 {
  margin: 16px 0 8px 0;
  font-size: 14px;
  color: var(--text-primary, #333);
}

.transaction-detail {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: white;
  border-radius: 4px;
  margin-bottom: 8px;
}

.tx-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.tx-category {
  font-size: 11px;
  color: var(--text-secondary, #666);
}

@media (max-width: 768px) {
  .calendar-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  
  .calendar-day {
    min-height: 80px;
  }
}
</style>


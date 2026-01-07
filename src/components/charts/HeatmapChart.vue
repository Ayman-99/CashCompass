<template>
  <div class="heatmap-container">
    <div class="heatmap-header">
      <h3>{{ title }}</h3>
      <div class="heatmap-legend">
        <span class="legend-item">
          <span class="legend-color" style="background: var(--heatmap-min)"></span>
          <span>Low</span>
        </span>
        <span class="legend-item">
          <span class="legend-color" style="background: var(--heatmap-max)"></span>
          <span>High</span>
        </span>
      </div>
    </div>
    <div class="heatmap-grid" :class="{ 'heatmap-weekly': type === 'weekly', 'heatmap-daily': type === 'daily' }">
      <div 
        v-for="(cell, index) in heatmapData" 
        :key="index"
        class="heatmap-cell"
        :style="{ backgroundColor: cell.color, opacity: cell.opacity }"
        :title="cell.tooltip"
        @click="onCellClick(cell)"
      >
        <span class="cell-value">{{ cell.displayValue }}</span>
        <span class="cell-label">{{ cell.label }}</span>
      </div>
    </div>
    <div v-if="selectedCell" class="heatmap-details">
      <h4>{{ selectedCell.label }}</h4>
      <p>Amount: {{ formatCurrency(selectedCell.value) }}</p>
      <p v-if="selectedCell.count">Transactions: {{ selectedCell.count }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  data: {
    type: Object,
    required: true
  },
  type: {
    type: String,
    default: 'daily', // 'daily' or 'weekly'
    validator: (value) => ['daily', 'weekly'].includes(value)
  },
  title: {
    type: String,
    default: 'Spending Heatmap'
  }
})

const emit = defineEmits(['cellClick'])

const selectedCell = ref(null)

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0)
}

const heatmapData = computed(() => {
  if (!props.data) return []
  
  const cells = []
  let minValue = Infinity
  let maxValue = -Infinity
  
  // Process data based on type
  if (props.type === 'daily') {
    // Daily heatmap - by day of week
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayData = props.data.byDayOfWeek || {}
    
    days.forEach(day => {
      const dayInfo = dayData[day] || { expense: 0, income: 0, count: 0 }
      const value = dayInfo.expense || 0
      minValue = Math.min(minValue, value)
      maxValue = Math.max(maxValue, value)
      
      cells.push({
        label: day.substring(0, 3),
        fullLabel: day,
        value: value,
        count: dayInfo.count || 0,
        income: dayInfo.income || 0,
        expense: dayInfo.expense || 0
      })
    })
  } else if (props.type === 'weekly') {
    // Weekly heatmap - by week of month
    const weeks = ['1-7', '8-14', '15-21', '22-31']
    const periodData = props.data.byTimeOfMonth || {}
    
    weeks.forEach(week => {
      const weekInfo = periodData[week] || { expense: 0, income: 0, count: 0 }
      const value = weekInfo.expense || 0
      minValue = Math.min(minValue, value)
      maxValue = Math.max(maxValue, value)
      
      cells.push({
        label: week,
        fullLabel: `Days ${week}`,
        value: value,
        count: weekInfo.count || 0,
        income: weekInfo.income || 0,
        expense: weekInfo.expense || 0
      })
    })
  }
  
  // Calculate colors and opacity
  const range = maxValue - minValue
  const getColor = (value) => {
    if (range === 0) return 'rgba(102, 126, 234, 0.3)'
    const ratio = (value - minValue) / range
    // Green to red gradient
    const r = Math.round(40 + (220 - 40) * ratio)
    const g = Math.round(167 - 167 * ratio)
    const b = Math.round(69 - 69 * ratio)
    return `rgba(${r}, ${g}, ${b}, ${0.3 + ratio * 0.7})`
  }
  
  return cells.map(cell => ({
    ...cell,
    color: getColor(cell.value),
    opacity: cell.value > 0 ? 1 : 0.3,
    displayValue: cell.value > 0 ? formatCurrency(cell.value) : '-',
    tooltip: `${cell.fullLabel}: ${formatCurrency(cell.value)} (${cell.count} transactions)`
  }))
})

const onCellClick = (cell) => {
  selectedCell.value = cell
  emit('cellClick', cell)
}
</script>

<style scoped>
.heatmap-container {
  padding: 20px;
  background: var(--card-bg, #fff);
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.heatmap-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.heatmap-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary, #333);
}

.heatmap-legend {
  display: flex;
  gap: 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary, #666);
}

.legend-color {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.heatmap-grid {
  display: grid;
  gap: 8px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.heatmap-daily {
  grid-template-columns: repeat(7, 1fr);
}

.heatmap-weekly {
  grid-template-columns: repeat(4, 1fr);
}

.heatmap-cell {
  aspect-ratio: 1;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  border: 2px solid transparent;
  padding: 8px;
}

.heatmap-cell:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  border-color: var(--primary-color, #667eea);
  z-index: 1;
  position: relative;
}

.cell-value {
  font-size: 14px;
  font-weight: bold;
  color: var(--text-primary, #333);
  margin-bottom: 4px;
}

.cell-label {
  font-size: 10px;
  color: var(--text-secondary, #666);
  text-transform: uppercase;
}

.heatmap-details {
  margin-top: 20px;
  padding: 16px;
  background: var(--input-bg, #f5f5f5);
  border-radius: 8px;
}

.heatmap-details h4 {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: var(--text-primary, #333);
}

.heatmap-details p {
  margin: 4px 0;
  font-size: 14px;
  color: var(--text-secondary, #666);
}

@media (max-width: 768px) {
  .heatmap-daily {
    grid-template-columns: repeat(4, 1fr);
  }
  
  .heatmap-weekly {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .cell-value {
    font-size: 12px;
  }
  
  .cell-label {
    font-size: 9px;
  }
}
</style>


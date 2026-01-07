<template>
  <div class="chart-container">
    <Doughnut :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  }
})

const chartData = computed(() => {
  const labels = props.data.map(item => item.name || item.account)
  const values = props.data.map(item => parseFloat(item.balance || item.balanceILS || 0))

  // Generate colors
  const colors = [
    '#007bff', '#28a745', '#ffc107', '#dc3545', '#6c757d',
    '#17a2b8', '#6610f2', '#e83e8c', '#fd7e14', '#20c997'
  ]

  return {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: colors.slice(0, values.length),
        borderWidth: 2,
        borderColor: '#fff'
      }
    ]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right'
    },
    tooltip: {
      callbacks: {
        label: function(context) {
          const label = context.label || ''
          const value = context.parsed || 0
          const total = context.dataset.data.reduce((a, b) => a + b, 0)
          const percentage = ((value / total) * 100).toFixed(1)
          return `${label}: ${value.toLocaleString('en-US', { style: 'currency', currency: 'ILS' })} (${percentage}%)`
        }
      }
    }
  }
}
</script>

<style scoped>
.chart-container {
  height: 300px;
  position: relative;
}
</style>


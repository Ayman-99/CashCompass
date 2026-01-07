<template>
  <div class="chart-container">
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

const props = defineProps({
  data: {
    type: Object,
    default: () => ({ labels: [], current: [], previous: [] })
  }
})

const chartData = computed(() => {
  return {
    labels: props.data.labels || [],
    datasets: [
      {
        label: 'Current Period',
        data: props.data.current || [],
        backgroundColor: 'rgba(102, 126, 234, 0.6)',
        borderColor: '#667eea',
        borderWidth: 2
      },
      {
        label: 'Previous Period',
        data: props.data.previous || [],
        backgroundColor: 'rgba(118, 75, 162, 0.6)',
        borderColor: '#764ba2',
        borderWidth: 2
      }
    ]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top'
    },
    tooltip: {
      callbacks: {
        label: function(context) {
          const label = context.dataset.label || ''
          const value = context.parsed.y || 0
          return `${label}: ${value.toLocaleString('en-US', { style: 'currency', currency: 'ILS' })}`
        }
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true
    }
  }
}
</script>

<style scoped>
.chart-container {
  height: 400px;
  position: relative;
}
</style>


<template>
  <div class="chart-container">
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  }
})

const isMobile = ref(false)

onMounted(() => {
  isMobile.value = window.innerWidth < 768
  const handleResize = () => {
    isMobile.value = window.innerWidth < 768
  }
  window.addEventListener('resize', handleResize)
  return () => window.removeEventListener('resize', handleResize)
})

const chartData = computed(() => {
  const labels = props.data.map(item => item.month || item.date)
  const income = props.data.map(item => parseFloat(item.income || 0))
  const expenses = props.data.map(item => parseFloat(item.expenses || 0))
  const net = props.data.map(item => parseFloat(item.net || 0))

  return {
    labels,
    datasets: [
      {
        label: 'Income',
        data: income,
        borderColor: '#28a745',
        backgroundColor: 'rgba(40, 167, 69, 0.1)',
        tension: 0.4
      },
      {
        label: 'Expenses',
        data: expenses,
        borderColor: '#dc3545',
        backgroundColor: 'rgba(220, 53, 69, 0.1)',
        tension: 0.4
      },
      {
        label: 'Net',
        data: net,
        borderColor: '#007bff',
        backgroundColor: 'rgba(0, 123, 255, 0.1)',
        tension: 0.4
      }
    ]
  }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false
  },
  plugins: {
    legend: {
      position: 'top',
      labels: {
        boxWidth: 12,
        padding: 10,
        font: {
          size: isMobile.value ? 11 : 12
        }
      }
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      padding: 10,
      titleFont: {
        size: isMobile.value ? 12 : 14
      },
      bodyFont: {
        size: isMobile.value ? 11 : 12
      }
    }
  },
  scales: {
    x: {
      ticks: {
        font: {
          size: isMobile.value ? 10 : 12
        },
        maxRotation: isMobile.value ? 45 : 0
      }
    },
    y: {
      beginAtZero: true,
      ticks: {
        font: {
          size: isMobile.value ? 10 : 12
        }
      }
    }
  }
}))
</script>

<style scoped>
.chart-container {
  height: 300px;
  position: relative;
  touch-action: pan-x pan-y;
  -webkit-tap-highlight-color: transparent;
}

@media (max-width: 768px) {
  .chart-container {
    height: 250px;
  }
}

@media (max-width: 480px) {
  .chart-container {
    height: 200px;
  }
}
</style>


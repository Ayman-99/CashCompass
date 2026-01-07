<template>
  <div class="sankey-container">
    <h3>{{ title }}</h3>
    <div class="sankey-diagram" ref="sankeyRef">
      <div class="sankey-nodes">
        <div 
          v-for="(node, index) in nodes" 
          :key="index"
          class="sankey-node"
          :style="{ 
            top: `${node.y}%`,
            left: node.side === 'left' ? '0' : 'auto',
            right: node.side === 'right' ? '0' : 'auto',
            width: `${node.width}%`
          }"
        >
          <div class="node-label">{{ node.label }}</div>
          <div class="node-value">{{ formatCurrency(node.value) }}</div>
        </div>
      </div>
      <svg class="sankey-links" :viewBox="`0 0 ${svgWidth} ${svgHeight}`">
        <path
          v-for="(link, index) in links"
          :key="index"
          :d="link.path"
          :stroke="link.color"
          :stroke-width="link.width"
          :fill="link.color"
          :opacity="0.6"
          class="sankey-link"
        />
      </svg>
    </div>
    <div class="sankey-legend">
      <div v-for="(item, index) in legend" :key="index" class="legend-item">
        <span class="legend-color" :style="{ backgroundColor: item.color }"></span>
        <span>{{ item.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'

const props = defineProps({
  data: {
    type: Object,
    required: true
  },
  title: {
    type: String,
    default: 'Cash Flow Diagram'
  }
})

const sankeyRef = ref(null)
const svgWidth = ref(800)
const svgHeight = ref(400)

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0)
}

// Calculate Sankey diagram nodes and links
const { nodes, links, legend } = computed(() => {
  if (!props.data || !props.data.analytics) {
    return { nodes: [], links: [], legend: [] }
  }
  
  const analytics = props.data.analytics
  const totalIncome = analytics.totalIncome || 0
  const totalExpense = analytics.totalExpense || 0
  const netBalance = analytics.netBalance || 0
  
  // Calculate node positions and sizes
  const maxValue = Math.max(totalIncome, totalExpense, Math.abs(netBalance))
  const scale = 100 / maxValue
  
  const nodeList = []
  const linkList = []
  const legendList = []
  
  // Income node (left side)
  if (totalIncome > 0) {
    const incomeHeight = (totalIncome * scale)
    nodeList.push({
      label: 'Income',
      value: totalIncome,
      y: 10,
      width: 15,
      side: 'left',
      color: '#28a745'
    })
    legendList.push({ label: 'Income', color: '#28a745' })
  }
  
  // Expense categories (right side)
  const topCategories = analytics.topExpenseCategories || []
  let currentY = 10
  const categoryNodes = []
  
  topCategories.slice(0, 5).forEach((category, index) => {
    const categoryName = Array.isArray(category) ? category[0] : category.category
    const categoryAmount = Array.isArray(category) ? category[1] : category.amount
    const categoryHeight = (categoryAmount * scale)
    
    categoryNodes.push({
      label: categoryName,
      value: categoryAmount,
      y: currentY,
      width: 15,
      side: 'right',
      color: '#dc3545',
      index: index
    })
    
    currentY += categoryHeight + 2
  })
  
  nodeList.push(...categoryNodes)
  
  // Create links from income to expenses
  if (totalIncome > 0 && categoryNodes.length > 0) {
    categoryNodes.forEach((categoryNode, index) => {
      const linkWidth = (categoryNode.value * scale) / 10
      linkList.push({
        source: { x: 20, y: 10 + (totalIncome * scale) / 2 },
        target: { x: 80, y: categoryNode.y + (categoryNode.value * scale) / 2 },
        width: Math.max(2, linkWidth),
        color: '#dc3545',
        value: categoryNode.value
      })
    })
  }
  
  // Net balance node
  if (netBalance !== 0) {
    const netHeight = Math.abs(netBalance * scale)
    nodeList.push({
      label: netBalance > 0 ? 'Savings' : 'Deficit',
      value: Math.abs(netBalance),
      y: currentY + 5,
      width: 15,
      side: 'right',
      color: netBalance > 0 ? '#28a745' : '#dc3545'
    })
    
    if (netBalance > 0) {
      linkList.push({
        source: { x: 20, y: 10 + (totalIncome * scale) / 2 },
        target: { x: 80, y: currentY + 5 + netHeight / 2 },
        width: Math.max(2, netHeight / 10),
        color: '#28a745',
        value: netBalance
      })
    }
  }
  
  // Generate SVG paths for links
  linkList.forEach(link => {
    const { source, target } = link
    const dx = target.x - source.x
    const dy = target.y - source.y
    
    // Create curved path
    const cp1x = source.x + dx * 0.5
    const cp1y = source.y
    const cp2x = target.x - dx * 0.5
    const cp2y = target.y
    
    link.path = `M ${source.x} ${source.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${target.x} ${target.y}`
  })
  
  return { nodes: nodeList, links: linkList, legend: legendList }
})

onMounted(() => {
  if (sankeyRef.value) {
    svgWidth.value = sankeyRef.value.offsetWidth || 800
    svgHeight.value = sankeyRef.value.offsetHeight || 400
  }
  
  const handleResize = () => {
    if (sankeyRef.value) {
      svgWidth.value = sankeyRef.value.offsetWidth || 800
      svgHeight.value = sankeyRef.value.offsetHeight || 400
    }
  }
  
  window.addEventListener('resize', handleResize)
  return () => window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.sankey-container {
  padding: 20px;
  background: var(--card-bg, #fff);
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.sankey-container h3 {
  margin: 0 0 20px 0;
  font-size: 18px;
  color: var(--text-primary, #333);
}

.sankey-diagram {
  position: relative;
  width: 100%;
  height: 400px;
  margin-bottom: 20px;
}

.sankey-nodes {
  position: relative;
  width: 100%;
  height: 100%;
}

.sankey-node {
  position: absolute;
  padding: 12px;
  background: white;
  border: 2px solid var(--input-border, #ddd);
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.node-label {
  font-size: 12px;
  font-weight: bold;
  color: var(--text-primary, #333);
  margin-bottom: 4px;
}

.node-value {
  font-size: 14px;
  color: var(--text-secondary, #666);
}

.sankey-links {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.sankey-link {
  pointer-events: stroke;
  transition: opacity 0.2s;
}

.sankey-link:hover {
  opacity: 1;
  stroke-width: 4;
}

.sankey-legend {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary, #666);
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

@media (max-width: 768px) {
  .sankey-diagram {
    height: 300px;
  }
  
  .node-label {
    font-size: 10px;
  }
  
  .node-value {
    font-size: 12px;
  }
}
</style>


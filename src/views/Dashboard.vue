<template>
  <div class="dashboard">
    <div class="container">
      <!-- Header with Filters -->
      <div class="dashboard-header">
        <h1>📊 Dashboard</h1>
        <div class="header-controls">
          <div class="quick-filters">
            <button 
              v-for="filter in quickFilters" 
              :key="filter.value"
              @click="setQuickFilter(filter.value)"
              :class="['quick-filter-btn', { active: activeQuickFilter === filter.value }]"
            >
              {{ filter.label }}
            </button>
          </div>
          <div class="date-filters">
            <input v-model="startDate" type="date" class="date-input" @change="applyDateRange" />
            <span>to</span>
            <input v-model="endDate" type="date" class="date-input" @change="applyDateRange" />
            <button @click="clearFilters" class="btn btn-secondary">Clear</button>
          </div>
        </div>
      </div>

      <div v-if="loading" class="loading">Loading dashboard data...</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      
      <div v-else>
        <!-- Budget Alerts Section -->
        <div class="card budget-alerts-section" v-if="budgetStatuses">
          <h2>📊 Budget Status & Alerts</h2>
          <div class="info-box">
            💡 <strong>Tip:</strong> Monitor your budget limits and monthly spending. Green = on track, Yellow = warning (90%+), Red = exceeded. Set up budgets in Settings → Alert Rules.
          </div>
          <div v-if="budgetStatuses.length === 0" class="no-budgets">
            <div class="no-budgets-icon">📊</div>
            <div class="no-budgets-title">No Budget Rules Configured</div>
            <div class="no-budgets-text">Set up monthly budgets or category limits to track your spending.</div>
            <router-link to="/settings" class="btn btn-primary">⚙️ Go to Settings</router-link>
          </div>
          <div v-else class="budgets-grid">
            <div 
              v-for="budget in budgetStatuses" 
              :key="budget.id"
              :class="['budget-card', budget.status]"
            >
              <div class="budget-header">
                <div class="budget-name">{{ budget.name }}</div>
                <div class="budget-status-badge" :class="budget.status">
                  {{ budget.status === 'exceeded' ? 'Exceeded' : budget.status === 'warning' ? 'Warning' : 'On Track' }}
                </div>
              </div>
              
              <div class="budget-scope" v-if="budget.categoryNames && budget.categoryNames.length > 0">
                📂 Categories: {{ budget.categoryNames.join(', ') }}
              </div>
              <div class="budget-scope" v-else-if="budget.accountName">
                🏦 Account: {{ budget.accountName }}
              </div>
              <div class="budget-scope" v-else>
                📊 Overall Spending
              </div>
              
              <div class="budget-period">
                {{ getPeriodLabel(budget.period) }}
              </div>

              <!-- Progress Bar -->
              <div class="budget-progress">
                <div class="budget-progress-bar">
                  <div 
                    class="budget-progress-fill" 
                    :class="budget.status"
                    :style="{ width: `${Math.min(100, budget.percentage)}%` }"
                  ></div>
                </div>
                <div class="budget-percentage">{{ budget.percentage.toFixed(1) }}%</div>
              </div>

              <!-- Amounts -->
              <div class="budget-amounts">
                <div class="budget-amount-item">
                  <div class="budget-amount-label">Spent</div>
                  <div class="budget-amount-value">{{ formatCurrency(budget.currentSpending) }} {{ budget.currency }}</div>
                </div>
                <div class="budget-amount-item">
                  <div class="budget-amount-label">{{ budget.exceeded ? 'Over by' : 'Remaining' }}</div>
                  <div class="budget-amount-value" :class="budget.exceeded ? 'negative' : 'positive'">
                    {{ formatCurrency(budget.exceeded ? budget.overBy : budget.remaining) }} {{ budget.currency }}
                  </div>
                </div>
              </div>

              <!-- Limit -->
              <div class="budget-limit">
                <div class="budget-limit-label">Budget Limit</div>
                <div class="budget-limit-value">{{ formatCurrency(budget.threshold) }} {{ budget.currency }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Net Worth Display -->
        <div class="net-worth-card" v-if="netWorth">
          <div class="net-worth-header">
            <div class="net-worth-label">💰 Total Net Worth</div>
            <div class="net-worth-value">{{ formatCurrency(netWorth.totalNetWorth) }} ILS</div>
          </div>
          <div class="account-breakdown-grid">
            <div 
              v-for="account in netWorth.accountBreakdown.slice(0, 6)" 
              :key="account.name"
              class="account-breakdown-item"
            >
              <div class="account-name">{{ account.name }}</div>
              <div class="account-balance">{{ formatCurrency(account.originalBalance) }} {{ account.currency }}</div>
              <div v-if="account.currency !== 'ILS'" class="account-balance-ils">
                ≈ {{ formatCurrency(account.balanceILS) }} ILS
              </div>
            </div>
          </div>
        </div>

        <!-- Summary Stats Grid -->
        <div class="stats-grid">
          <div class="stat-card income">
            <div class="stat-label">Total Income</div>
            <div class="stat-value positive">{{ formatCurrency(analytics?.totalIncome || 0) }}</div>
          </div>
          <div class="stat-card expense">
            <div class="stat-label">Total Expenses</div>
            <div class="stat-value negative">{{ formatCurrency(analytics?.totalExpense || analytics?.totalExpenses || 0) }}</div>
          </div>
          <div class="stat-card net">
            <div class="stat-label">Net Balance</div>
            <div class="stat-value" :class="(analytics?.netBalance || 0) >= 0 ? 'positive' : 'negative'">
              {{ formatCurrency(analytics?.netBalance || 0) }}
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Total Transactions</div>
            <div class="stat-value">{{ analytics?.totalTransactions || analytics?.transactionCount || 0 }}</div>
          </div>
        </div>

        <!-- Financial Health Score & Insights -->
        <div class="insights-section" v-if="insights">
          <div class="insights-grid">
            <div class="health-score-card" :style="{ background: `linear-gradient(135deg, ${insights.healthColor} 0%, ${insights.healthColor}dd 100%)` }">
              <div class="health-score-label">Financial Health Score</div>
              <div class="health-score-value">{{ insights.healthScore }}</div>
              <div class="health-score-label-text">{{ insights.healthLabel }}</div>
            </div>
            <div class="insight-card">
              <div class="insight-label">💰 Spending Velocity</div>
              <div class="insight-value">{{ formatCurrency(insights.expenseVelocity) }}/day</div>
              <div class="insight-subtext">Based on {{ insights.daysInPeriod }} days</div>
            </div>
            <div class="insight-card" v-if="insights.topDay">
              <div class="insight-label">📅 Top Spending Day</div>
              <div class="insight-value">{{ insights.topDay.name }}</div>
              <div class="insight-subtext">{{ formatCurrency(insights.topDay.amount) }}</div>
            </div>
            <div class="insight-card">
              <div class="insight-label">📊 Month Split</div>
              <div class="insight-split">
                <div class="split-item">
                  <div class="split-label">1st Half</div>
                  <div class="split-value">{{ formatCurrency(insights.firstHalf) }}</div>
                </div>
                <div class="split-item">
                  <div class="split-label">2nd Half</div>
                  <div class="split-value">{{ formatCurrency(insights.secondHalf) }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Day of Week Breakdown -->
          <div class="day-breakdown" v-if="insights.dayBreakdown && insights.dayBreakdown.length > 0">
            <h3>📈 Spending by Day of Week</h3>
            <div class="day-breakdown-list">
              <div v-for="day in insights.dayBreakdown" :key="day.day" class="day-item">
                <div class="day-header">
                  <span class="day-name">{{ day.day }}</span>
                  <span class="day-amount">{{ formatCurrency(day.amount) }}</span>
                </div>
                <div class="day-progress-bar">
                  <div class="day-progress-fill" :style="{ width: `${day.percentage}%` }"></div>
                </div>
                <div class="day-percentage">{{ day.percentage }}% of weekly spending</div>
              </div>
            </div>
          </div>

          <!-- Key Insights -->
          <div class="key-insights" v-if="insights.insights && insights.insights.length > 0">
            <h3>💡 Key Insights</h3>
            <div class="insights-list">
              <div v-for="(insight, index) in insights.insights" :key="index" class="insight-item">
                {{ insight }}
              </div>
            </div>
          </div>
        </div>

        <!-- Detailed Reports -->
        <div class="card detailed-reports">
          <h2>📊 Detailed Financial Reports</h2>
          <div class="reports-grid">
            <div class="report-card">
              <div class="report-label">Average Daily Income</div>
              <div class="report-value">{{ formatCurrency(analytics?.dailyAverages?.income || 0) }}</div>
            </div>
            <div class="report-card">
              <div class="report-label">Average Daily Expense</div>
              <div class="report-value">{{ formatCurrency(analytics?.dailyAverages?.expense || 0) }}</div>
            </div>
            <div class="report-card">
              <div class="report-label">Savings Rate</div>
              <div class="report-value">
                {{ analytics?.totalIncome > 0 ? (((analytics?.netBalance || 0) / analytics.totalIncome) * 100).toFixed(1) : 0 }}%
              </div>
            </div>
            <div class="report-card">
              <div class="report-label">Total Categories</div>
              <div class="report-value">{{ Object.keys(analytics?.byCategory || {}).length }}</div>
            </div>
          </div>
        </div>

        <!-- Charts Section -->
        <div class="charts-section">
          <!-- Monthly Trends with Period Switching -->
          <div class="card">
            <div class="chart-header">
              <h2>📈 Financial Trends</h2>
              <div class="chart-period-switcher">
                <button 
                  v-for="period in chartPeriods" 
                  :key="period"
                  @click="currentChartPeriod = period"
                  :class="['chart-period-btn', { active: currentChartPeriod === period }]"
                >
                  {{ period.charAt(0).toUpperCase() + period.slice(1) }}
                </button>
              </div>
            </div>
            <MonthlyTrendsChart :data="trendsByPeriod" />
          </div>

          <!-- Category Spending Over Time -->
          <div class="card" v-if="categoryTrendsData">
            <h2>📊 Category Spending Over Time</h2>
            <CategoryTrendsChart :data="categoryTrendsData" />
          </div>

          <!-- Period Comparison -->
          <div class="card" v-if="periodComparison">
            <h2>📉 Period Comparison</h2>
            <PeriodComparisonChart :data="periodComparison" />
          </div>

          <!-- Two Column Charts -->
          <div class="two-column-charts">
            <div class="card">
              <h2>💸 Expense Categories Breakdown</h2>
              <CategoryChart :data="expenseCategoriesData" />
            </div>
            <div class="card">
              <h2>💵 Income Categories Breakdown</h2>
              <IncomeChart :data="incomeCategoriesData" />
            </div>
          </div>

          <!-- Account Distribution -->
          <div class="card" v-if="accountDistributionData">
            <h2>🏦 Account Distribution</h2>
            <AccountDistributionChart :data="accountDistributionData" />
          </div>
        </div>

        <!-- Top Categories Tables -->
        <div class="two-column-charts">
          <div class="card">
            <h2>💸 Top Expense Categories</h2>
            <table class="categories-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Category</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in topExpenseCategories" :key="index">
                  <td>{{ index + 1 }}</td>
                  <td>{{ Array.isArray(item) ? item[0] : item.name || item.category }}</td>
                  <td class="negative">{{ formatCurrency(Array.isArray(item) ? item[1] : item.amount || item.total) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="card">
            <h2>💵 Top Income Categories</h2>
            <table class="categories-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Category</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in topIncomeCategories" :key="index">
                  <td>{{ index + 1 }}</td>
                  <td>{{ Array.isArray(item) ? item[0] : item.name || item.category }}</td>
                  <td class="positive">{{ formatCurrency(Array.isArray(item) ? item[1] : item.amount || item.total) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Enhanced Predictions & Forecasting -->
        <div class="card" v-if="predictions">
          <h2>🔮 Advanced Predictions & Forecasting</h2>
          
          <!-- Trend Forecasting -->
          <div class="forecasting-section">
            <h3>📈 Trend Forecasting</h3>
            <div class="forecast-grid">
              <div class="forecast-card">
                <div class="forecast-label">Next 7 Days</div>
                <div class="forecast-value" :class="getForecastClass(forecastData.next7Days?.net)">
                  {{ formatCurrency(forecastData.next7Days?.net || 0) }}
                </div>
                <div class="forecast-trend" v-if="forecastData.next7Days">
                  <span :class="['trend-indicator', forecastData.next7Days.trend]">
                    {{ forecastData.next7Days.trend === 'up' ? '📈' : forecastData.next7Days.trend === 'down' ? '📉' : '➡️' }}
                    {{ forecastData.next7Days.changePercent?.toFixed(1) || 0 }}%
                  </span>
                </div>
                <div class="forecast-details">
                  <div>Income: {{ formatCurrency(forecastData.next7Days?.income || 0) }}</div>
                  <div>Expense: {{ formatCurrency(forecastData.next7Days?.expense || 0) }}</div>
                </div>
              </div>
              
              <div class="forecast-card">
                <div class="forecast-label">Next Month Forecast</div>
                <div class="forecast-value" :class="getForecastClass(predictions.nextMonth?.net || predictions.nextMonth?.netBalance)">
                  {{ formatCurrency(predictions.nextMonth?.net || predictions.nextMonth?.netBalance || 0) }}
                </div>
                <div class="forecast-trend" v-if="forecastData.nextMonth">
                  <span :class="['trend-indicator', forecastData.nextMonth.trend]">
                    {{ forecastData.nextMonth.trend === 'up' ? '📈' : forecastData.nextMonth.trend === 'down' ? '📉' : '➡️' }}
                    {{ forecastData.nextMonth.changePercent?.toFixed(1) || 0 }}%
                  </span>
                </div>
                <div class="forecast-details">
                  <div>Income: {{ formatCurrency(predictions.nextMonth?.income || 0) }}</div>
                  <div>Expense: {{ formatCurrency(predictions.nextMonth?.expense || 0) }}</div>
                </div>
              </div>
              
              <div class="forecast-card">
                <div class="forecast-label">3-Month Projection</div>
                <div class="forecast-value" :class="getForecastClass(predictions.next3Months?.net || predictions.threeMonth?.netBalance)">
                  {{ formatCurrency(predictions.next3Months?.net || predictions.threeMonth?.netBalance || 0) }}
                </div>
                <div class="forecast-trend" v-if="forecastData.next3Months">
                  <span :class="['trend-indicator', forecastData.next3Months.trend]">
                    {{ forecastData.next3Months.trend === 'up' ? '📈' : forecastData.next3Months.trend === 'down' ? '📉' : '➡️' }}
                    {{ forecastData.next3Months.changePercent?.toFixed(1) || 0 }}%
                  </span>
                </div>
              </div>
              
              <div class="forecast-card">
                <div class="forecast-label">Next Year Projection</div>
                <div class="forecast-value" :class="getForecastClass(predictions.nextYear?.net)">
                  {{ formatCurrency(predictions.nextYear?.net || 0) }}
                </div>
                <div class="forecast-trend" v-if="forecastData.nextYear">
                  <span :class="['trend-indicator', forecastData.nextYear.trend]">
                    {{ forecastData.nextYear.trend === 'up' ? '📈' : forecastData.nextYear.trend === 'down' ? '📉' : '➡️' }}
                    {{ forecastData.nextYear.changePercent?.toFixed(1) || 0 }}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Spending Predictions -->
          <div class="spending-predictions-section" v-if="spendingPredictions.length > 0">
            <h3>💰 Spending Predictions</h3>
            <div class="predictions-list">
              <div 
                v-for="(prediction, index) in spendingPredictions" 
                :key="index"
                class="prediction-item"
              >
                <div class="prediction-icon">{{ prediction.icon }}</div>
                <div class="prediction-content">
                  <div class="prediction-title">{{ prediction.title }}</div>
                  <div class="prediction-description">{{ prediction.description }}</div>
                  <div class="prediction-amount" v-if="prediction.amount">
                    {{ formatCurrency(prediction.amount) }}
                  </div>
                </div>
                <div class="prediction-confidence" v-if="prediction.confidence">
                  <div class="confidence-label">Confidence</div>
                  <div class="confidence-value">{{ prediction.confidence }}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Category Comparison Over Time -->
        <div class="card" v-if="availableCategories.length > 0">
          <h2>📊 Category Comparison Over Time</h2>
          <div class="category-comparison-controls">
            <div class="comparison-selector">
              <label>Compare Categories:</label>
              <select v-model="selectedComparisonCategories" multiple class="category-select" @change="updateCategoryComparison">
                <option v-for="category in availableCategories" :key="category" :value="category">
                  {{ category }}
                </option>
              </select>
              <small>Hold Ctrl/Cmd to select multiple</small>
            </div>
            <div class="comparison-period">
              <label>Comparison Period:</label>
              <select v-model="comparisonPeriod" @change="updateCategoryComparison">
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
          </div>
          <div v-if="selectedComparisonCategories.length > 0 && categoryComparisonData" class="category-comparison-chart">
            <CategoryTrendsChart :data="categoryComparisonData" />
          </div>
          <div v-else-if="selectedComparisonCategories.length === 0" class="empty-state">
            <p>Select categories above to compare their spending over time</p>
          </div>
        </div>

        <!-- Savings Tips -->
        <div class="card" v-if="tips && tips.length > 0">
          <h2>💡 Savings Tips & Recommendations</h2>
          <div class="tips-grid">
            <div 
              v-for="(tip, index) in tips" 
              :key="index" 
              :class="['tip-card', tip.impact?.toLowerCase() || 'low']"
            >
              <div class="tip-header">
                <div class="tip-title">
                  <span class="tip-icon">{{ index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '💡' }}</span>
                  {{ tip.title }}
                </div>
                <span :class="['tip-impact', tip.impact?.toLowerCase() || 'low']">
                  {{ tip.impact || 'Low' }} Impact
                </span>
              </div>
              <div class="tip-message">{{ tip.message || tip.description }}</div>
              <div v-if="tip.potentialSavings > 0" class="tip-savings">
                <div class="tip-savings-label">💰 Potential Savings</div>
                <div class="tip-savings-value">{{ formatCurrency(tip.potentialSavings) }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Comprehensive Reports Section -->
        <div class="card reports-section">
          <div class="reports-header">
            <h2>📊 Comprehensive Financial Reports</h2>
            <div class="reports-actions">
              <button @click="expandedReport = expandedReport ? null : 'all'" class="btn btn-secondary">
                {{ expandedReport ? 'Collapse All' : 'Expand All' }}
              </button>
              <button @click="exportReports" class="btn btn-primary" :disabled="!analytics">
                📥 Export Reports
              </button>
            </div>
          </div>

          <!-- Report Tabs -->
          <div class="report-tabs">
            <button 
              v-for="report in reportTypes" 
              :key="report.id"
              @click="activeReport = report.id"
              :class="['report-tab', { active: activeReport === report.id }]"
            >
              {{ report.icon }} {{ report.name }}
            </button>
          </div>

          <!-- Cash Flow Report -->
          <div v-show="activeReport === 'cashflow'" class="report-content">
            <div class="report-title">
              <h3>💰 Cash Flow Analysis</h3>
              <p class="report-subtitle">Track your income and expenses over time</p>
            </div>
            <div class="report-tips">
              <div class="tip-box">
                <strong>💡 Tips:</strong>
                <ul>
                  <li><strong>Positive Net Cash Flow</strong> means you're earning more than you spend - great for building savings!</li>
                  <li><strong>Negative Net Cash Flow</strong> indicates you're spending more than you earn - review expenses to identify areas to cut back.</li>
                  <li><strong>Savings Rate</strong> shows what percentage of income you're saving. Aim for at least 20% for financial security.</li>
                  <li>Use the <strong>Category Breakdown</strong> to identify which categories consume most of your cash flow.</li>
                  <li>Compare cash flow across different date ranges to spot trends and seasonal patterns.</li>
                </ul>
              </div>
            </div>
            <div class="cashflow-grid">
              <div class="cashflow-card">
                <div class="cashflow-label">Total Cash Inflow</div>
                <div class="cashflow-value positive">{{ formatCurrency(analytics?.totalIncome || 0) }}</div>
                <div class="cashflow-detail">Average: {{ formatCurrency(analytics?.dailyAverages?.income || 0) }}/day</div>
              </div>
              <div class="cashflow-card">
                <div class="cashflow-label">Total Cash Outflow</div>
                <div class="cashflow-value negative">{{ formatCurrency(analytics?.totalExpense || analytics?.totalExpenses || 0) }}</div>
                <div class="cashflow-detail">Average: {{ formatCurrency(analytics?.dailyAverages?.expense || 0) }}/day</div>
              </div>
              <div class="cashflow-card">
                <div class="cashflow-label">Net Cash Flow</div>
                <div class="cashflow-value" :class="(analytics?.netBalance || 0) >= 0 ? 'positive' : 'negative'">
                  {{ formatCurrency(analytics?.netBalance || 0) }}
                </div>
                <div class="cashflow-detail">
                  Savings Rate: {{ analytics?.totalIncome > 0 ? (((analytics?.netBalance || 0) / analytics.totalIncome) * 100).toFixed(1) : 0 }}%
                </div>
              </div>
            </div>
            <div class="cashflow-breakdown" v-if="analytics?.byCategory">
              <h4>Cash Flow by Category</h4>
              <div class="cashflow-table">
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(amount, category) in analytics.byCategory" :key="category">
                      <td>{{ category }}</td>
                      <td>
                        <span :class="['type-badge', amount >= 0 ? 'income' : 'expense']">
                          {{ amount >= 0 ? 'Income' : 'Expense' }}
                        </span>
                      </td>
                      <td :class="amount >= 0 ? 'positive' : 'negative'">
                        {{ formatCurrency(Math.abs(amount)) }}
                      </td>
                      <td>
                        {{ analytics?.totalIncome > 0 && amount > 0 ? 
                          ((amount / analytics.totalIncome) * 100).toFixed(1) : 
                          analytics?.totalExpense > 0 && amount < 0 ? 
                          ((Math.abs(amount) / analytics.totalExpense) * 100).toFixed(1) : 0 }}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Category Performance Report -->
          <div v-show="activeReport === 'category'" class="report-content">
            <div class="report-title">
              <h3>📈 Category Performance Analysis</h3>
              <p class="report-subtitle">Detailed breakdown of spending and income by category</p>
            </div>
            <div class="report-tips">
              <div class="tip-box">
                <strong>💡 Tips:</strong>
                <ul>
                  <li><strong>Top Expense Categories</strong> show where most of your money goes - focus on reducing these first for maximum impact.</li>
                  <li><strong>Progress Bars</strong> help you quickly identify categories with the highest spending relative to others.</li>
                  <li>Compare <strong>Income vs Expense Categories</strong> to see if you have diverse income sources.</li>
                  <li>If a single category dominates spending, consider setting a budget limit for it in Settings.</li>
                  <li>Use this report to identify categories that have grown unexpectedly - they may need attention.</li>
                </ul>
              </div>
            </div>
            <div class="category-performance-grid">
              <div class="performance-section">
                <h4>💸 Top Expense Categories</h4>
                <div class="performance-list">
                  <div 
                    v-for="(item, index) in topExpenseCategories.slice(0, 10)" 
                    :key="index"
                    class="performance-item"
                  >
                    <div class="performance-rank">#{{ index + 1 }}</div>
                    <div class="performance-info">
                      <div class="performance-name">{{ Array.isArray(item) ? item[0] : item.name || item.category }}</div>
                      <div class="performance-bar-container">
                        <div 
                          class="performance-bar" 
                          :style="{ 
                            width: `${(Array.isArray(item) ? item[1] : item.amount || item.total) / (topExpenseCategories[0] ? (Array.isArray(topExpenseCategories[0]) ? topExpenseCategories[0][1] : topExpenseCategories[0].amount || topExpenseCategories[0].total) : 1) * 100}%` 
                          }"
                        ></div>
                      </div>
                    </div>
                    <div class="performance-amount negative">
                      {{ formatCurrency(Array.isArray(item) ? item[1] : item.amount || item.total) }}
                    </div>
                  </div>
                </div>
              </div>
              <div class="performance-section">
                <h4>💵 Top Income Categories</h4>
                <div class="performance-list">
                  <div 
                    v-for="(item, index) in topIncomeCategories.slice(0, 10)" 
                    :key="index"
                    class="performance-item"
                  >
                    <div class="performance-rank">#{{ index + 1 }}</div>
                    <div class="performance-info">
                      <div class="performance-name">{{ Array.isArray(item) ? item[0] : item.name || item.category }}</div>
                      <div class="performance-bar-container">
                        <div 
                          class="performance-bar positive" 
                          :style="{ 
                            width: `${(Array.isArray(item) ? item[1] : item.amount || item.total) / (topIncomeCategories[0] ? (Array.isArray(topIncomeCategories[0]) ? topIncomeCategories[0][1] : topIncomeCategories[0].amount || topIncomeCategories[0].total) : 1) * 100}%` 
                          }"
                        ></div>
                      </div>
                    </div>
                    <div class="performance-amount positive">
                      {{ formatCurrency(Array.isArray(item) ? item[1] : item.amount || item.total) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Account Performance Report -->
          <div v-show="activeReport === 'account'" class="report-content">
            <div class="report-title">
              <h3>🏦 Account Performance Report</h3>
              <p class="report-subtitle">Transaction activity and balance changes by account</p>
            </div>
            <div class="report-tips">
              <div class="tip-box">
                <strong>💡 Tips:</strong>
                <ul>
                  <li><strong>Net Change</strong> shows how much each account's balance changed during the selected period.</li>
                  <li>Accounts with <strong>high transaction counts</strong> but low amounts may indicate many small purchases - consider consolidating.</li>
                  <li><strong>Transfers</strong> between accounts don't affect your total net worth, but help you track money movement.</li>
                  <li>Compare <strong>Income vs Expenses</strong> per account to see which accounts are most active.</li>
                  <li>Use this report to identify accounts that need attention or rebalancing.</li>
                </ul>
              </div>
            </div>
            <div v-if="accountSummary && accountSummary.length > 0" class="account-summary-table">
              <table>
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Currency</th>
                    <th>Income</th>
                    <th>Expenses</th>
                    <th>Transfers</th>
                    <th>Net Change</th>
                    <th>Current Balance</th>
                    <th>Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="account in accountSummary" :key="account.name">
                    <td><strong>{{ account.name }}</strong></td>
                    <td>{{ account.currency }}</td>
                    <td class="positive">{{ formatCurrency(account.income || 0) }}</td>
                    <td class="negative">{{ formatCurrency(account.expenses || 0) }}</td>
                    <td>{{ formatCurrency(account.transfers || 0) }}</td>
                    <td :class="(account.netChange || 0) >= 0 ? 'positive' : 'negative'">
                      {{ formatCurrency(account.netChange || 0) }}
                    </td>
                    <td><strong>{{ formatCurrency(account.balance || 0) }}</strong></td>
                    <td>{{ account.transactionCount || 0 }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="empty-state">
              <p>No account data available for the selected period.</p>
            </div>
          </div>

          <!-- Recurring Transactions Report -->
          <div v-show="activeReport === 'recurring'" class="report-content">
            <div class="report-title">
              <h3>🔄 Recurring Transactions Analysis</h3>
              <p class="report-subtitle">Identify patterns and recurring expenses</p>
            </div>
            <div class="report-tips">
              <div class="tip-box">
                <strong>💡 Tips:</strong>
                <ul>
                  <li><strong>Recurring Expenses</strong> are predictable costs like subscriptions, bills, or regular purchases.</li>
                  <li>Review recurring expenses regularly - cancel unused subscriptions to save money.</li>
                  <li><strong>Frequency</strong> shows how often transactions occur - daily, weekly, monthly, etc.</li>
                  <li>High-frequency recurring expenses can add up quickly - multiply by frequency to see annual cost.</li>
                  <li>Use this report to identify opportunities for bulk purchases or annual subscriptions that might save money.</li>
                  <li>Consider setting up budgets for recurring expenses to ensure you don't overspend.</li>
                </ul>
              </div>
            </div>
            <div v-if="recurringData && recurringData.length > 0" class="recurring-list">
              <div 
                v-for="(item, index) in recurringData" 
                :key="index"
                class="recurring-item"
              >
                <div class="recurring-icon">{{ item.type === 'Expense' ? '💸' : '💵' }}</div>
                <div class="recurring-info">
                  <div class="recurring-name">{{ item.description || item.category || 'Unnamed' }}</div>
                  <div class="recurring-details">
                    <span>Amount: {{ formatCurrency(Math.abs(item.amount || 0)) }}</span>
                    <span>Frequency: {{ item.frequency || 'Regular' }}</span>
                    <span>Occurrences: {{ item.count || 0 }}</span>
                  </div>
                </div>
                <div class="recurring-amount" :class="item.type === 'Expense' ? 'negative' : 'positive'">
                  {{ formatCurrency(Math.abs(item.amount || 0)) }}
                </div>
              </div>
            </div>
            <div v-else class="empty-state">
              <p>No recurring transaction patterns detected for the selected period.</p>
            </div>
          </div>

          <!-- Spending Patterns Report -->
          <div v-show="activeReport === 'patterns'" class="report-content">
            <div class="report-title">
              <h3>📅 Spending Patterns Analysis</h3>
              <p class="report-subtitle">Understand when and how you spend</p>
            </div>
            <div class="report-tips">
              <div class="tip-box">
                <strong>💡 Tips:</strong>
                <ul>
                  <li><strong>Day of Week Breakdown</strong> reveals your spending habits - do you spend more on weekends?</li>
                  <li>If spending is <strong>concentrated in the first half</strong> of the month, you might run out of money before month-end.</li>
                  <li><strong>Spending Velocity</strong> shows your daily average - compare it to your monthly budget to stay on track.</li>
                  <li>Use <strong>Top Spending Day</strong> insights to plan ahead and avoid overspending on high-spend days.</li>
                  <li>If you notice patterns (e.g., high spending on Fridays), set reminders to review purchases on those days.</li>
                  <li>Balanced spending throughout the month is healthier than concentrated spending periods.</li>
                </ul>
              </div>
            </div>
            <div class="patterns-grid">
              <div class="pattern-card">
                <h4>📊 Day of Week Breakdown</h4>
                <div v-if="insights?.dayBreakdown" class="day-breakdown-report">
                  <div 
                    v-for="day in insights.dayBreakdown" 
                    :key="day.day"
                    class="day-breakdown-item"
                  >
                    <div class="day-name">{{ day.day }}</div>
                    <div class="day-bar-container">
                      <div 
                        class="day-bar" 
                        :style="{ width: `${day.percentage}%` }"
                      ></div>
                    </div>
                    <div class="day-amount">{{ formatCurrency(day.amount) }}</div>
                    <div class="day-percentage">{{ day.percentage }}%</div>
                  </div>
                </div>
              </div>
              <div class="pattern-card">
                <h4>📈 Month Split Analysis</h4>
                <div class="month-split-report">
                  <div class="split-item">
                    <div class="split-label">First Half (1-15)</div>
                    <div class="split-value">{{ formatCurrency(insights?.firstHalf || 0) }}</div>
                    <div class="split-percentage">
                      {{ insights?.firstHalf && insights?.secondHalf ? 
                        ((insights.firstHalf / (insights.firstHalf + insights.secondHalf)) * 100).toFixed(1) : 0 }}%
                    </div>
                  </div>
                  <div class="split-item">
                    <div class="split-label">Second Half (16-31)</div>
                    <div class="split-value">{{ formatCurrency(insights?.secondHalf || 0) }}</div>
                    <div class="split-percentage">
                      {{ insights?.firstHalf && insights?.secondHalf ? 
                        ((insights.secondHalf / (insights.firstHalf + insights.secondHalf)) * 100).toFixed(1) : 0 }}%
                    </div>
                  </div>
                </div>
              </div>
              <div class="pattern-card">
                <h4>⚡ Spending Velocity</h4>
                <div class="velocity-stats">
                  <div class="velocity-item">
                    <div class="velocity-label">Daily Average</div>
                    <div class="velocity-value">{{ formatCurrency(insights?.expenseVelocity || 0) }}/day</div>
                  </div>
                  <div class="velocity-item">
                    <div class="velocity-label">Period Duration</div>
                    <div class="velocity-value">{{ insights?.daysInPeriod || 0 }} days</div>
                  </div>
                  <div class="velocity-item" v-if="insights?.topDay">
                    <div class="velocity-label">Top Spending Day</div>
                    <div class="velocity-value">{{ insights.topDay.name }}</div>
                    <div class="velocity-subvalue">{{ formatCurrency(insights.topDay.amount) }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Budget vs Actual Report -->
          <div v-show="activeReport === 'budget'" class="report-content">
            <div class="report-title">
              <h3>🎯 Budget vs Actual Performance</h3>
              <p class="report-subtitle">Compare your budgets with actual spending</p>
            </div>
            <div class="report-tips">
              <div class="tip-box">
                <strong>💡 Tips:</strong>
                <ul>
                  <li><strong>On Track (Green)</strong> means you're spending within your budget - keep it up!</li>
                  <li><strong>Warning (Yellow)</strong> indicates you've used 90%+ of your budget - slow down spending.</li>
                  <li><strong>Exceeded (Red)</strong> means you've gone over budget - review expenses and adjust future spending.</li>
                  <li><strong>Variance</strong> shows the difference between budgeted and actual amounts - positive is good for expenses.</li>
                  <li>Use <strong>Percentage Used</strong> to track progress throughout the period - aim to stay under 100%.</li>
                  <li>If you consistently exceed budgets, consider increasing the limit or reducing spending in that category.</li>
                  <li>Set up budgets in <strong>Settings → Alert Rules</strong> to track spending automatically.</li>
                </ul>
              </div>
            </div>
            <div v-if="budgetStatuses && budgetStatuses.length > 0" class="budget-vs-actual">
              <div 
                v-for="budget in budgetStatuses" 
                :key="budget.id"
                class="budget-comparison-card"
              >
                <div class="budget-comparison-header">
                  <div class="budget-comparison-name">{{ budget.name }}</div>
                  <div class="budget-comparison-status" :class="budget.status">
                    {{ budget.status === 'exceeded' ? '⚠️ Exceeded' : budget.status === 'warning' ? '⚡ Warning' : '✅ On Track' }}
                  </div>
                </div>
                <div class="budget-comparison-details">
                  <div class="comparison-row">
                    <span class="comparison-label">Budget Limit:</span>
                    <span class="comparison-value">{{ formatCurrency(budget.threshold) }} {{ budget.currency }}</span>
                  </div>
                  <div class="comparison-row">
                    <span class="comparison-label">Actual Spending:</span>
                    <span class="comparison-value">{{ formatCurrency(budget.currentSpending) }} {{ budget.currency }}</span>
                  </div>
                  <div class="comparison-row">
                    <span class="comparison-label">Variance:</span>
                    <span class="comparison-value" :class="budget.exceeded ? 'negative' : 'positive'">
                      {{ budget.exceeded ? '+' : '' }}{{ formatCurrency(budget.exceeded ? budget.overBy : budget.remaining) }} {{ budget.currency }}
                    </span>
                  </div>
                  <div class="comparison-row">
                    <span class="comparison-label">Percentage Used:</span>
                    <span class="comparison-value">{{ budget.percentage.toFixed(1) }}%</span>
                  </div>
                </div>
                <div class="budget-comparison-progress">
                  <div 
                    class="budget-comparison-bar" 
                    :class="budget.status"
                    :style="{ width: `${Math.min(100, budget.percentage)}%` }"
                  ></div>
                </div>
              </div>
            </div>
            <div v-else class="empty-state">
              <p>No budgets configured. Set up budgets in Settings → Alert Rules.</p>
            </div>
          </div>

          <!-- Year-over-Year Comparison -->
          <div v-show="activeReport === 'yoy'" class="report-content">
            <div class="report-title">
              <h3>📊 Year-over-Year Comparison</h3>
              <p class="report-subtitle">Compare current period with the same period last year</p>
            </div>
            <div class="report-tips">
              <div class="tip-box">
                <strong>💡 Tips:</strong>
                <ul>
                  <li><strong>Positive Change (Green)</strong> in income is good, while positive change in expenses means you're spending more.</li>
                  <li><strong>Negative Change (Red)</strong> in income is concerning, but negative change in expenses means you're spending less (good!).</li>
                  <li>Use this comparison to identify <strong>trends</strong> - are you improving financially year over year?</li>
                  <li>Consider <strong>seasonal factors</strong> - some periods naturally have higher or lower spending.</li>
                  <li>If expenses increased significantly, review what changed in your lifestyle or circumstances.</li>
                  <li>Compare <strong>Net Balance</strong> changes to see if your overall financial health is improving.</li>
                  <li>Use this data to set realistic goals for the next year based on historical patterns.</li>
                </ul>
              </div>
            </div>
            <div class="yoy-comparison">
              <div class="yoy-card">
                <div class="yoy-label">Current Period</div>
                <div class="yoy-period">{{ formatDateRange(startDate, endDate) }}</div>
                <div class="yoy-stats">
                  <div class="yoy-stat">
                    <span class="yoy-stat-label">Income:</span>
                    <span class="yoy-stat-value positive">{{ formatCurrency(analytics?.totalIncome || 0) }}</span>
                  </div>
                  <div class="yoy-stat">
                    <span class="yoy-stat-label">Expenses:</span>
                    <span class="yoy-stat-value negative">{{ formatCurrency(analytics?.totalExpense || analytics?.totalExpenses || 0) }}</span>
                  </div>
                  <div class="yoy-stat">
                    <span class="yoy-stat-label">Net:</span>
                    <span class="yoy-stat-value" :class="(analytics?.netBalance || 0) >= 0 ? 'positive' : 'negative'">
                      {{ formatCurrency(analytics?.netBalance || 0) }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="yoy-card">
                <div class="yoy-label">Previous Period</div>
                <div class="yoy-period">{{ formatDateRange(previousStartDate, previousEndDate) }}</div>
                <div class="yoy-stats">
                  <div class="yoy-stat">
                    <span class="yoy-stat-label">Income:</span>
                    <span class="yoy-stat-value positive">{{ formatCurrency(previousAnalytics?.totalIncome || 0) }}</span>
                  </div>
                  <div class="yoy-stat">
                    <span class="yoy-stat-label">Expenses:</span>
                    <span class="yoy-stat-value negative">{{ formatCurrency(previousAnalytics?.totalExpense || previousAnalytics?.totalExpenses || 0) }}</span>
                  </div>
                  <div class="yoy-stat">
                    <span class="yoy-stat-label">Net:</span>
                    <span class="yoy-stat-value" :class="(previousAnalytics?.netBalance || 0) >= 0 ? 'positive' : 'negative'">
                      {{ formatCurrency(previousAnalytics?.netBalance || 0) }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="yoy-card yoy-change">
                <div class="yoy-label">Change</div>
                <div class="yoy-stats">
                  <div class="yoy-stat">
                    <span class="yoy-stat-label">Income:</span>
                    <span class="yoy-stat-value" :class="getChangeClass(yoyChange.income)">
                      {{ formatChange(yoyChange.income) }}
                    </span>
                  </div>
                  <div class="yoy-stat">
                    <span class="yoy-stat-label">Expenses:</span>
                    <span class="yoy-stat-value" :class="getChangeClass(yoyChange.expenses)">
                      {{ formatChange(yoyChange.expenses) }}
                    </span>
                  </div>
                  <div class="yoy-stat">
                    <span class="yoy-stat-label">Net:</span>
                    <span class="yoy-stat-value" :class="getChangeClass(yoyChange.net)">
                      {{ formatChange(yoyChange.net) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Advanced Analytics Section -->
        <div class="card advanced-analytics-section">
          <div class="section-header">
            <h2>🔬 Advanced Analytics & AI Insights</h2>
            <button 
              @click="showAdvancedAnalytics = !showAdvancedAnalytics; if (showAdvancedAnalytics) loadAdvancedAnalytics()"
              class="btn btn-secondary"
            >
              {{ showAdvancedAnalytics ? 'Hide' : 'Show' }} Advanced Analytics
            </button>
          </div>
          
          <div v-if="showAdvancedAnalytics">
            <div v-if="loadingAdvanced" class="advanced-loading">
              <div class="loading-spinner"></div>
              <p>Loading advanced analytics...</p>
            </div>
            
            <div v-else>
              <!-- Financial Health Score -->
              <div v-if="healthScore" class="health-score-card">
                <div class="section-title-row">
                  <h3>🏥 Financial Health Score</h3>
                  <div class="info-tooltip">
                    <span class="info-icon">ℹ️</span>
                    <div class="tooltip-content">
                      <strong>Understanding Your Health Score:</strong>
                      <ul>
                        <li><strong>Score (0-100):</strong> Overall financial health rating</li>
                        <li><strong>Grade:</strong> A+ (90+) = Excellent, A (80-89) = Good, B (70-79) = Fair, C (60-69) = Needs Improvement, D (50-59) = Poor</li>
                        <li><strong>Savings Rate:</strong> Percentage of income saved</li>
                        <li><strong>Months of Expenses:</strong> Emergency fund coverage</li>
                        <li><strong>Expense Stability:</strong> Consistency in spending patterns</li>
                        <li><strong>Spending Velocity:</strong> Rate of spending acceleration</li>
                        <li><strong>Future Outlook:</strong> Projected financial trajectory</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div class="health-score-display">
                  <div class="score-circle" :class="getHealthScoreClass(healthScore.score)">
                    <div class="score-value">{{ healthScore.score }}</div>
                    <div class="score-grade">{{ healthScore.grade }}</div>
                  </div>
                  <div class="score-breakdown">
                    <div class="breakdown-item">
                      <span class="label">Savings Rate:</span>
                      <span class="value">{{ healthScore.breakdown.savingsRate }}%</span>
                    </div>
                    <div class="breakdown-item">
                      <span class="label">Months of Expenses:</span>
                      <span class="value">{{ healthScore.breakdown.monthsOfExpenses }}</span>
                    </div>
                    <div class="breakdown-item">
                      <span class="label">Expense Stability:</span>
                      <span class="value">{{ healthScore.breakdown.expenseStability }}</span>
                    </div>
                    <div class="breakdown-item">
                      <span class="label">Spending Velocity:</span>
                      <span class="value">{{ healthScore.breakdown.spendingVelocity }}</span>
                    </div>
                    <div class="breakdown-item">
                      <span class="label">Future Outlook:</span>
                      <span class="value">{{ healthScore.breakdown.futureOutlook }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Spending Velocity -->
              <div v-if="spendingVelocity" class="velocity-card">
                <div class="section-title-row">
                  <h3>⚡ Spending Velocity</h3>
                  <div class="info-tooltip">
                    <span class="info-icon">ℹ️</span>
                    <div class="tooltip-content">
                      <strong>Understanding Spending Velocity:</strong>
                      <ul>
                        <li><strong>Daily/Weekly/Monthly Average:</strong> Your average spending rate</li>
                        <li><strong>Trend:</strong> Accelerating = spending increasing, Decelerating = spending decreasing, Stable = consistent</li>
                        <li><strong>Burn Rate:</strong> Days until your balance reaches zero at current spending rate</li>
                        <li><strong>Tip:</strong> Lower velocity and stable trends indicate better financial control</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div class="velocity-stats">
                  <div class="velocity-stat">
                    <div class="stat-label">Daily Average</div>
                    <div class="stat-value">{{ formatCurrency(spendingVelocity.daily) }}</div>
                  </div>
                  <div class="velocity-stat">
                    <div class="stat-label">Weekly Average</div>
                    <div class="stat-value">{{ formatCurrency(spendingVelocity.weekly) }}</div>
                  </div>
                  <div class="velocity-stat">
                    <div class="stat-label">Monthly Average</div>
                    <div class="stat-value">{{ formatCurrency(spendingVelocity.monthly) }}</div>
                  </div>
                  <div class="velocity-stat">
                    <div class="stat-label">Trend</div>
                    <div class="stat-value" :class="spendingVelocity.trend">
                      {{ spendingVelocity.trend }}
                    </div>
                  </div>
                  <div v-if="spendingVelocity.burnRate" class="velocity-stat">
                    <div class="stat-label">Burn Rate</div>
                    <div class="stat-value">{{ spendingVelocity.burnRate }} days</div>
                  </div>
                </div>
              </div>

              <!-- AI Insights -->
              <div v-if="aiInsights && aiInsights.length > 0" class="ai-insights-card">
                <div class="section-title-row">
                  <h3>🤖 AI Insights & Recommendations</h3>
                  <div class="info-tooltip">
                    <span class="info-icon">ℹ️</span>
                    <div class="tooltip-content">
                      <strong>Understanding AI Insights:</strong>
                      <ul>
                        <li><strong>Impact Levels:</strong> High = Critical, Medium = Important, Low = Informational</li>
                        <li><strong>Spending Patterns:</strong> Identifies unusual spending behaviors</li>
                        <li><strong>Anomaly Detection:</strong> Flags transactions that deviate from your normal patterns</li>
                        <li><strong>Recommendations:</strong> Actionable advice based on your spending data</li>
                        <li><strong>Category Analysis:</strong> Insights about specific spending categories</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div class="insights-list">
                  <div 
                    v-for="(insight, index) in aiInsights" 
                    :key="index"
                    class="insight-item"
                    :class="insight.impact"
                  >
                    <div class="insight-header">
                      <span class="insight-type">{{ insight.category }}</span>
                      <span class="insight-impact" :class="insight.impact">{{ insight.impact }}</span>
                    </div>
                    <div class="insight-title">{{ insight.title }}</div>
                    <div class="insight-message">{{ insight.message }}</div>
                    <div v-if="insight.action" class="insight-action">
                      💡 {{ insight.action }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Spending Patterns Heatmap -->
              <div v-if="spendingPatterns" class="patterns-section">
                <div class="section-title-row">
                  <h3>📅 Spending Patterns</h3>
                  <div class="info-tooltip">
                    <span class="info-icon">ℹ️</span>
                    <div class="tooltip-content">
                      <strong>Understanding Spending Patterns:</strong>
                      <ul>
                        <li><strong>By Day of Week:</strong> Shows which days you spend most (e.g., weekends vs weekdays)</li>
                        <li><strong>By Time of Month:</strong> Reveals spending patterns throughout the month (early, mid, or late month)</li>
                        <li><strong>Color Intensity:</strong> Darker colors = higher spending, Lighter colors = lower spending</li>
                        <li><strong>Use Case:</strong> Identify spending habits to optimize budget timing and reduce impulse purchases</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div class="patterns-grid-container">
                  <div class="patterns-grid">
                    <div class="pattern-card">
                      <h4>By Day of Week</h4>
                      <div class="heatmap-wrapper">
                        <HeatmapChart 
                          :data="spendingPatterns" 
                          type="daily"
                          title="Daily Spending Pattern"
                        />
                      </div>
                    </div>
                    <div class="pattern-card">
                      <h4>By Time of Month</h4>
                      <div class="heatmap-wrapper">
                        <HeatmapChart 
                          :data="spendingPatterns" 
                          type="weekly"
                          title="Monthly Spending Pattern"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Cash Flow Calendar -->
              <div v-if="cashFlowCalendar && cashFlowCalendar.length > 0" class="calendar-section">
                <div class="section-title-row">
                  <h3>📆 Cash Flow Calendar</h3>
                  <div class="info-tooltip">
                    <span class="info-icon">ℹ️</span>
                    <div class="tooltip-content">
                      <strong>Understanding Cash Flow Calendar:</strong>
                      <ul>
                        <li><strong>Daily Breakdown:</strong> See income and expenses for each day</li>
                        <li><strong>Net Balance:</strong> Daily net change (income - expenses)</li>
                        <li><strong>View Modes:</strong> Month view shows all days, Week view shows last 7 days with details</li>
                        <li><strong>Click Days:</strong> Click any day to see detailed transaction list</li>
                        <li><strong>Use Case:</strong> Identify cash flow patterns and plan for high-expense days</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <CashFlowCalendar :data="cashFlowCalendar" />
              </div>

              <!-- Merchant Analysis -->
              <div v-if="merchants && merchants.length > 0" class="merchants-section">
                <div class="section-title-row">
                  <h3>🏪 Top Merchants & Vendors</h3>
                  <div class="info-tooltip">
                    <span class="info-icon">ℹ️</span>
                    <div class="tooltip-content">
                      <strong>Understanding Merchant Analysis:</strong>
                      <ul>
                        <li><strong>Ranking:</strong> Merchants sorted by total spending</li>
                        <li><strong>Transaction Count:</strong> Number of purchases at each merchant</li>
                        <li><strong>Average Amount:</strong> Average transaction value</li>
                        <li><strong>Total Spent:</strong> Cumulative spending at merchant</li>
                        <li><strong>Use Case:</strong> Identify where you spend most and negotiate better deals or find alternatives</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div class="merchants-list">
                  <div 
                    v-for="(merchant, index) in merchants.slice(0, 10)" 
                    :key="index"
                    class="merchant-item"
                  >
                    <div class="merchant-rank">#{{ index + 1 }}</div>
                    <div class="merchant-info">
                      <div class="merchant-name">{{ merchant.name }}</div>
                      <div class="merchant-details">
                        <span>{{ merchant.transactionCount }} transactions</span>
                        <span>•</span>
                        <span>Avg: {{ formatCurrency(merchant.avgAmount) }}</span>
                      </div>
                    </div>
                    <div class="merchant-amount">
                      <div class="spent">{{ formatCurrency(merchant.totalSpent) }}</div>
                      <div v-if="merchant.totalReceived > 0" class="received">
                        +{{ formatCurrency(merchant.totalReceived) }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Sankey Diagram -->
              <div v-if="analytics" class="sankey-section">
                <div class="section-title-row">
                  <h3>🌊 Cash Flow Visualization</h3>
                  <div class="info-tooltip">
                    <span class="info-icon">ℹ️</span>
                    <div class="tooltip-content">
                      <strong>Understanding Cash Flow Diagram:</strong>
                      <ul>
                        <li><strong>Flow Direction:</strong> Shows how income flows to expense categories</li>
                        <li><strong>Line Width:</strong> Thicker lines = more money flowing</li>
                        <li><strong>Left Side:</strong> Your income sources</li>
                        <li><strong>Right Side:</strong> Top expense categories</li>
                        <li><strong>Savings/Deficit:</strong> Shows remaining balance after expenses</li>
                        <li><strong>Use Case:</strong> Visualize spending allocation and identify major expense categories</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <SankeyChart :data="{ analytics }" title="Income to Expenses Flow" />
              </div>

              <!-- Expenses by Person/Company -->
              <div v-if="expensesByPerson && expensesByPerson.length > 0" class="expenses-by-person-section">
                <div class="section-title-row">
                  <h3>💸 Expenses by Person/Company</h3>
                  <div class="info-tooltip">
                    <span class="info-icon">ℹ️</span>
                    <div class="tooltip-content">
                      <strong>Understanding Expenses by Person:</strong>
                      <ul>
                        <li>Shows all expenses where "Person/Company" field is filled</li>
                        <li>Helps track spending with specific people or businesses</li>
                        <li>Useful for identifying where you spend money with others</li>
                        <li>Categories show spending breakdown per person</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div class="expenses-person-list">
                  <div 
                    v-for="person in expensesByPerson" 
                    :key="person.person"
                    class="expense-person-item"
                  >
                    <div class="expense-person-header">
                      <div class="expense-person-name">
                        <strong>{{ person.person }}</strong>
                        <span class="expense-count">{{ person.transactionCount }} transactions</span>
                      </div>
                      <div class="expense-person-total negative">
                        {{ formatCurrency(person.totalExpense) }}
                      </div>
                    </div>
                    
                    <div class="expense-categories">
                      <div 
                        v-for="(amount, category) in person.categories" 
                        :key="category"
                        class="expense-category-item"
                      >
                        <span class="category-name">{{ category }}</span>
                        <span class="category-amount">{{ formatCurrency(amount) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Debt by Person (Debt Category) -->
              <div v-if="debtByPerson && debtByPerson.length > 0" class="debt-by-person-section">
                <div class="section-title-row">
                  <h3>💳 Debt Transactions by Person (Debt Category)</h3>
                  <div class="info-tooltip">
                    <span class="info-icon">ℹ️</span>
                    <div class="tooltip-content">
                      <strong>Understanding Debt by Person:</strong>
                      <ul>
                        <li><strong>Expense Debt:</strong> Money you lent (Expense with Debt category)</li>
                        <li><strong>Income Debt:</strong> Money returned (Income with Debt category)</li>
                        <li><strong>Net Debt:</strong> How much they still owe you</li>
                        <li>Only shows transactions with "Debt" category</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div class="debt-person-list">
                  <div 
                    v-for="debt in debtByPerson" 
                    :key="debt.person"
                    class="debt-person-item"
                    :class="{ 'repaid': debt.isRepaid, 'outstanding': !debt.isRepaid }"
                  >
                    <div class="debt-person-header">
                      <div class="debt-person-name">
                        <strong>{{ debt.person }}</strong>
                        <span class="debt-status" :class="debt.isRepaid ? 'status-repaid' : 'status-outstanding'">
                          {{ debt.isRepaid ? '✓ Repaid' : '⚠ Outstanding' }}
                        </span>
                      </div>
                      <div class="debt-net" :class="debt.netDebt > 0 ? 'negative' : 'positive'">
                        {{ formatCurrency(debt.netDebt) }}
                      </div>
                    </div>
                    
                    <div class="debt-breakdown">
                      <div class="debt-breakdown-item">
                        <span class="label">Expense Debt (Lent):</span>
                        <span class="value negative">{{ formatCurrency(debt.expenseDebt) }}</span>
                      </div>
                      <div class="debt-breakdown-item">
                        <span class="label">Income Debt (Repaid):</span>
                        <span class="value positive">{{ formatCurrency(debt.incomeDebt) }}</span>
                      </div>
                      <div class="debt-breakdown-item">
                        <span class="label">Transactions:</span>
                        <span class="value">{{ debt.transactionCount }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Loans & Debts Tracking -->
              <div v-if="loansData" class="loans-section">
                <div class="section-title-row">
                  <h3>💰 Loans & Debts Tracking</h3>
                  <div class="info-tooltip">
                    <span class="info-icon">ℹ️</span>
                    <div class="tooltip-content">
                      <strong>How to Track Loans:</strong>
                      <ul>
                        <li><strong>When you lend money:</strong> Create an Expense transaction with the person's name in "Person/Company" field</li>
                        <li><strong>When money is returned:</strong> Create an Income transaction with the same person's name</li>
                        <li><strong>Outstanding:</strong> Shows how much each person still owes you</li>
                        <li><strong>Repayment Rate:</strong> Percentage of loan that has been repaid</li>
                        <li><strong>Green = Repaid:</strong> Fully paid back, Red = Still owes money</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div v-if="loansData.summary" class="loans-summary">
                  <div class="summary-card">
                    <div class="summary-label">Total Lent</div>
                    <div class="summary-value">{{ formatCurrency(loansData.summary.totalLent) }}</div>
                  </div>
                  <div class="summary-card">
                    <div class="summary-label">Total Repaid</div>
                    <div class="summary-value positive">{{ formatCurrency(loansData.summary.totalRepaid) }}</div>
                  </div>
                  <div class="summary-card">
                    <div class="summary-label">Outstanding</div>
                    <div class="summary-value" :class="loansData.summary.totalOutstanding > 0 ? 'negative' : 'positive'">
                      {{ formatCurrency(loansData.summary.totalOutstanding) }}
                    </div>
                  </div>
                  <div class="summary-card">
                    <div class="summary-label">Active Loans</div>
                    <div class="summary-value">{{ loansData.summary.activeLoans }} / {{ loansData.summary.totalPeople }}</div>
                  </div>
                </div>

                <div v-if="loansData.loans && loansData.loans.length > 0" class="loans-list">
                  <div 
                    v-for="loan in loansData.loans" 
                    :key="loan.person"
                    class="loan-item"
                    :class="{ 'repaid': loan.isRepaid, 'outstanding': !loan.isRepaid }"
                  >
                    <div class="loan-header">
                      <div class="loan-person">
                        <strong>{{ loan.person }}</strong>
                        <span class="loan-status" :class="loan.isRepaid ? 'status-repaid' : 'status-outstanding'">
                          {{ loan.isRepaid ? '✓ Repaid' : '⚠ Outstanding' }}
                        </span>
                      </div>
                      <div class="loan-outstanding" :class="loan.outstanding > 0 ? 'negative' : 'positive'">
                        {{ formatCurrency(loan.outstanding) }}
                      </div>
                    </div>
                    
                    <div class="loan-details">
                      <div class="loan-detail-item">
                        <span class="label">Lent:</span>
                        <span class="value">{{ formatCurrency(loan.totalLent) }}</span>
                      </div>
                      <div class="loan-detail-item">
                        <span class="label">Repaid:</span>
                        <span class="value positive">{{ formatCurrency(loan.totalRepaid) }}</span>
                      </div>
                      <div class="loan-detail-item">
                        <span class="label">Repayment Rate:</span>
                        <span class="value">{{ loan.repaymentRate.toFixed(1) }}%</span>
                      </div>
                      <div class="loan-detail-item">
                        <span class="label">Transactions:</span>
                        <span class="value">{{ loan.transactions.length }}</span>
                      </div>
                    </div>
                    
                    <div v-if="loan.transactions.length > 0" class="loan-transactions">
                      <details>
                        <summary>View Transactions ({{ loan.transactions.length }})</summary>
                        <div class="transactions-list">
                          <div 
                            v-for="tx in loan.transactions.slice().reverse()" 
                            :key="tx.id"
                            class="transaction-item"
                            :class="tx.type.toLowerCase()"
                          >
                            <div class="tx-date">{{ formatDate(tx.date) }}</div>
                            <div class="tx-description">{{ tx.description || 'No description' }}</div>
                            <div class="tx-amount" :class="tx.type.toLowerCase()">
                              {{ tx.type === 'Income' ? '+' : '-' }}{{ formatCurrency(Math.abs(tx.amount)) }}
                            </div>
                          </div>
                        </div>
                      </details>
                    </div>
                  </div>
                </div>
                
                <div v-else class="no-loans">
                  <p>No loans or debts tracked yet.</p>
                  <p class="hint">💡 To track loans: When lending money, create an Expense transaction and enter the person's name in the "Person/Company" field. When repaid, create an Income transaction with the same name.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import analyticsService from '../services/analyticsService'
import { accountService } from '../services/accountService'
import { settingsService } from '../services/settingsService'
import MonthlyTrendsChart from '../components/charts/MonthlyTrendsChart.vue'
import CategoryChart from '../components/charts/CategoryChart.vue'
import IncomeChart from '../components/charts/IncomeChart.vue'
import AccountDistributionChart from '../components/charts/AccountDistributionChart.vue'
import CategoryTrendsChart from '../components/charts/CategoryTrendsChart.vue'
import PeriodComparisonChart from '../components/charts/PeriodComparisonChart.vue'
import HeatmapChart from '../components/charts/HeatmapChart.vue'
import CashFlowCalendar from '../components/charts/CashFlowCalendar.vue'
import SankeyChart from '../components/charts/SankeyChart.vue'
import cache from '../utils/cache'
import backgroundSync from '../utils/backgroundSync'
import { format, subMonths, startOfYear, startOfMonth, subDays } from 'date-fns'

const analytics = ref(null)
const predictions = ref(null)
const tips = ref([])
const loading = ref(true)
const error = ref(null)
const netWorth = ref(null)
const insights = ref(null)
const budgetStatuses = ref([])
const recurringData = ref([])
const accountSummary = ref([])
const previousAnalytics = ref(null)

// Advanced Analytics
const forecastData = ref({})
const spendingPredictions = ref([])
const selectedComparisonCategories = ref([])
const comparisonPeriod = ref('monthly')
const categoryComparisonData = ref(null)
const availableCategories = ref([])

// New Advanced Analytics Features
const advancedAnalytics = ref(null)
const spendingPatterns = ref(null)
const merchants = ref([])
const cashFlowCalendar = ref([])
const healthScore = ref(null)
const spendingVelocity = ref(null)
const aiInsights = ref([])
const showAdvancedAnalytics = ref(false)
const loadingAdvanced = ref(false)
const loansData = ref(null)
const expensesByPerson = ref([])
const debtByPerson = ref([])

// Reports section
const activeReport = ref('cashflow')
const expandedReport = ref(null)
const reportTypes = [
  { id: 'cashflow', name: 'Cash Flow', icon: '💰' },
  { id: 'category', name: 'Category Performance', icon: '📈' },
  { id: 'account', name: 'Account Performance', icon: '🏦' },
  { id: 'recurring', name: 'Recurring Transactions', icon: '🔄' },
  { id: 'patterns', name: 'Spending Patterns', icon: '📅' },
  { id: 'budget', name: 'Budget vs Actual', icon: '🎯' },
  { id: 'yoy', name: 'Year-over-Year', icon: '📊' }
]

// Date filters
const startDate = ref('')
const endDate = ref('')
const activeQuickFilter = ref('all')
const quickFilters = [
  { label: 'All Time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'Last Month', value: 'lastMonth' },
  { label: 'Last 3 Months', value: '3months' },
  { label: 'Last 6 Months', value: '6months' },
  { label: 'This Year', value: 'year' },
  { label: 'Last Year', value: 'lastYear' },
  { label: 'Custom', value: 'custom' }
]

// Chart period switching
const currentChartPeriod = ref('daily')
const chartPeriods = ['daily', 'weekly', 'monthly']

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 2
  }).format(amount || 0)
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  })
}

const setQuickFilter = (period) => {
  activeQuickFilter.value = period
  const today = new Date()
  let start = null
  let end = format(today, 'yyyy-MM-dd')

  switch (period) {
    case 'today':
      start = format(today, 'yyyy-MM-dd')
      end = format(today, 'yyyy-MM-dd')
      break
    case 'week':
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - today.getDay()) // Start of week (Sunday)
      start = format(weekStart, 'yyyy-MM-dd')
      break
    case 'month':
      start = format(startOfMonth(today), 'yyyy-MM-dd')
      break
    case 'lastMonth':
      const lastMonth = subMonths(today, 1)
      start = format(startOfMonth(lastMonth), 'yyyy-MM-dd')
      end = format(new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0), 'yyyy-MM-dd')
      break
    case '3months':
      start = format(subMonths(today, 3), 'yyyy-MM-dd')
      break
    case '6months':
      start = format(subMonths(today, 6), 'yyyy-MM-dd')
      break
    case 'year':
      start = format(startOfYear(today), 'yyyy-MM-dd')
      break
    case 'lastYear':
      const lastYear = new Date(today.getFullYear() - 1, 0, 1)
      const lastYearEnd = new Date(today.getFullYear() - 1, 11, 31)
      start = format(lastYear, 'yyyy-MM-dd')
      end = format(lastYearEnd, 'yyyy-MM-dd')
      break
    case 'custom':
      // Don't change dates, just mark as custom
      break
    case 'all':
    default:
      start = null
      end = null
      break
  }

  if (period !== 'custom') {
    startDate.value = start || ''
    endDate.value = end || ''
    loadDashboardData()
  }
}

const clearFilters = () => {
  activeQuickFilter.value = 'all'
  startDate.value = ''
  endDate.value = ''
  loadDashboardData()
}

const applyDateRange = () => {
  activeQuickFilter.value = 'custom'
  loadDashboardData()
}

// Calculate Net Worth
const calculateNetWorth = async () => {
  try {
    const data = await accountService.getAccounts(true) // convertToILS = true
    const accounts = data.accounts || []
    
    let totalNetWorth = 0
    const accountBreakdown = []
    
    for (const account of accounts) {
      const balanceILS = account.balanceILS !== undefined ? parseFloat(account.balanceILS) : parseFloat(account.balance) || 0
      const accountCurrency = account.currency || 'ILS'
      const originalBalance = parseFloat(account.balance) || 0
      
      totalNetWorth += balanceILS
      accountBreakdown.push({
        name: account.name,
        currency: accountCurrency,
        balance: balanceILS,
        originalBalance: originalBalance,
        balanceILS: balanceILS
      })
    }
    
    return { totalNetWorth, accountBreakdown }
  } catch (error) {
    console.error('Error calculating net worth:', error)
    return { totalNetWorth: 0, accountBreakdown: [] }
  }
}

// Calculate Financial Insights
const calculateInsights = () => {
  if (!analytics.value || !analytics.value.transactions) {
    return null
  }

  const transactions = analytics.value.transactions || []
  const expenseTransactions = transactions.filter(t => t.type === 'Expense')
  
  // Day of week analysis
  const dayOfWeekSpending = {}
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  
  expenseTransactions.forEach(t => {
    if (t.dateIso) {
      const date = new Date(t.dateIso)
      const dayName = dayNames[date.getDay()]
      if (!dayOfWeekSpending[dayName]) dayOfWeekSpending[dayName] = 0
      dayOfWeekSpending[dayName] += Math.abs(t.convertedAmount || 0)
    }
  })
  
  // Time of month analysis
  let firstHalfSpending = 0
  let secondHalfSpending = 0
  expenseTransactions.forEach(t => {
    if (t.dateIso) {
      const date = new Date(t.dateIso)
      const day = date.getDate()
      const amount = Math.abs(t.convertedAmount || 0)
      if (day <= 15) firstHalfSpending += amount
      else secondHalfSpending += amount
    }
  })
  
  const topDay = Object.entries(dayOfWeekSpending).sort((a, b) => b[1] - a[1])[0]
  const daysInPeriod = analytics.value.dateRange?.start && analytics.value.dateRange?.end ? 
    Math.ceil((new Date(analytics.value.dateRange.end) - new Date(analytics.value.dateRange.start)) / (1000 * 60 * 60 * 24)) : 30
  const expenseVelocity = (analytics.value.totalExpense || analytics.value.totalExpenses || 0) / Math.max(1, daysInPeriod)
  
  // Financial health score
  let healthScore = 50
  const totalIncome = analytics.value.totalIncome || 0
  const totalExpense = analytics.value.totalExpense || analytics.value.totalExpenses || 0
  
  if (totalIncome > 0) {
    const savingsRate = ((analytics.value.netBalance || 0) / totalIncome) * 100
    if (savingsRate > 20) healthScore += 30
    else if (savingsRate > 10) healthScore += 20
    else if (savingsRate > 0) healthScore += 10
    else if (savingsRate < -10) healthScore -= 20
    else healthScore -= 10
  }
  
  if (expenseVelocity > 0 && analytics.value.dailyAverages?.expense > 0) {
    const consistency = Math.min(20, (1 - Math.abs(expenseVelocity - analytics.value.dailyAverages.expense) / analytics.value.dailyAverages.expense) * 20)
    healthScore += consistency
  }
  
  if ((analytics.value.totalTransactions || analytics.value.transactionCount || 0) > 10) healthScore += 10
  if (Object.keys(analytics.value.byCategory || {}).length > 5) healthScore += 10
  
  healthScore = Math.min(100, Math.max(0, healthScore))
  
  const healthColor = healthScore >= 80 ? '#11998e' : healthScore >= 60 ? '#f093fb' : '#eb3349'
  const healthLabel = healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : 'Needs Improvement'
  
  // Generate insights
  const insightsList = []
  if (firstHalfSpending > secondHalfSpending * 1.2) {
    insightsList.push('⚠️ You spend significantly more in the first half of the month. Consider spreading expenses.')
  }
  if (secondHalfSpending > firstHalfSpending * 1.2) {
    insightsList.push('💡 You tend to spend more in the second half. Plan ahead for month-end expenses.')
  }
  if (analytics.value.netBalance < 0) {
    insightsList.push('🔴 You\'re spending more than you earn. Review your expenses.')
  } else if (totalIncome > 0 && analytics.value.netBalance / totalIncome > 0.2) {
    insightsList.push('✅ Great savings rate! You\'re saving over 20% of your income.')
  }
  if (expenseVelocity > analytics.value.dailyAverages?.expense * 1.5) {
    insightsList.push('⚡ Spending velocity is high. Monitor your daily expenses.')
  }
  if (Object.keys(analytics.value.byCategory || {}).length < 5) {
    insightsList.push('📊 Consider categorizing more transactions for better insights.')
  }
  if (insightsList.length === 0) {
    insightsList.push('🎉 Your financial patterns look healthy! Keep up the good work.')
  }
  
  // Day breakdown
  const dayBreakdown = Object.entries(dayOfWeekSpending)
    .sort((a, b) => dayNames.indexOf(a[0]) - dayNames.indexOf(b[0]))
    .map(([day, amount]) => {
      const total = Object.values(dayOfWeekSpending).reduce((sum, val) => sum + val, 0)
      const percentage = total > 0 ? parseFloat(((amount / total) * 100).toFixed(1)) : 0
      return { day, amount, percentage }
    })
  
  return {
    healthScore: Math.round(healthScore),
    healthColor,
    healthLabel,
    expenseVelocity,
    daysInPeriod,
    topDay: topDay ? { name: topDay[0], amount: topDay[1] } : null,
    firstHalf: firstHalfSpending,
    secondHalf: secondHalfSpending,
    dayBreakdown,
    insights: insightsList
  }
}

// Calculate trends by period
const trendsByPeriod = computed(() => {
  if (!analytics.value || !analytics.value.transactions) return []
  
  const transactions = analytics.value.transactions || []
  const trends = {}
  
  transactions.forEach(t => {
    if (!t.dateIso) return
    const date = new Date(t.dateIso)
    let key
    
    if (currentChartPeriod.value === 'daily') {
      key = format(date, 'yyyy-MM-dd')
    } else if (currentChartPeriod.value === 'weekly') {
      const weekStart = subDays(date, date.getDay())
      key = `Week ${format(weekStart, 'yyyy-MM-dd')}`
    } else {
      key = format(date, 'yyyy-MM')
    }
    
    if (!trends[key]) {
      trends[key] = { income: 0, expense: 0, net: 0 }
    }
    
    const amount = t.convertedAmount || 0
    if (t.type === 'Income') {
      trends[key].income += amount
    } else if (t.type === 'Expense') {
      trends[key].expense += amount
    }
    trends[key].net = trends[key].income - trends[key].expense
  })
  
  return Object.entries(trends)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, data]) => ({ 
      month: label, 
      date: label,
      income: data.income, 
      expenses: data.expense, 
      net: data.net 
    }))
})

// Category trends
const categoryTrendsData = computed(() => {
  if (!analytics.value || !analytics.value.transactions) return null
  
  const transactions = analytics.value.transactions || []
  const categoryData = {}
  
  transactions.forEach(t => {
    if (!t.category || t.type !== 'Expense') return
    if (!t.dateIso) return
    
    const date = new Date(t.dateIso)
    const month = format(date, 'yyyy-MM')
    const category = t.category
    
    if (!categoryData[category]) {
      categoryData[category] = {}
    }
    if (!categoryData[category][month]) {
      categoryData[category][month] = 0
    }
    categoryData[category][month] += t.convertedAmount || 0
  })
  
  const allMonths = new Set()
  Object.values(categoryData).forEach(months => {
    Object.keys(months).forEach(month => allMonths.add(month))
  })
  const sortedMonths = Array.from(allMonths).sort()
  
  const topCategories = (analytics.value.topExpenseCategories || []).slice(0, 5).map(([cat]) => cat)
  
  return {
    labels: sortedMonths,
    datasets: topCategories.map((category, idx) => {
      const colors = ['#eb3349', '#f45c43', '#ff6b6b', '#ee5a6f', '#c44569']
      return {
        label: category,
        data: sortedMonths.map(month => categoryData[category]?.[month] || 0),
        borderColor: colors[idx % colors.length],
        backgroundColor: colors[idx % colors.length] + '40',
        tension: 0.4,
        fill: false
      }
    })
  }
})

// Period comparison
const periodComparison = computed(() => {
  if (!analytics.value || !analytics.value.transactions) return null
  
  const transactions = analytics.value.transactions || []
  if (transactions.length === 0) return null
  
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  
  const currentPeriod = transactions.filter(t => {
    if (!t.dateIso) return false
    const date = new Date(t.dateIso)
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear
  })
  
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear
  const previousPeriod = transactions.filter(t => {
    if (!t.dateIso) return false
    const date = new Date(t.dateIso)
    return date.getMonth() === prevMonth && date.getFullYear() === prevYear
  })
  
  const calculateTotals = (trans) => {
    return {
      income: trans.filter(t => t.type === 'Income').reduce((sum, t) => sum + (t.convertedAmount || 0), 0),
      expense: trans.filter(t => t.type === 'Expense').reduce((sum, t) => sum + (t.convertedAmount || 0), 0)
    }
  }
  
  const current = calculateTotals(currentPeriod)
  const previous = calculateTotals(previousPeriod)
  
  return {
    labels: ['Income', 'Expenses'],
    current: [current.income, current.expense],
    previous: [previous.income, previous.expense]
  }
})

// Expense categories data
const expenseCategoriesData = computed(() => {
  if (!analytics.value || !analytics.value.topExpenseCategories) return []
  return analytics.value.topExpenseCategories.slice(0, 10).map(([name, amount]) => ({
    name,
    amount
  }))
})

// Income categories data
const incomeCategoriesData = computed(() => {
  if (!analytics.value || !analytics.value.topIncomeCategories) return []
  return analytics.value.topIncomeCategories.slice(0, 10).map(([name, amount]) => ({
    name,
    amount
  }))
})

// Account distribution
const accountDistributionData = computed(() => {
  if (!netWorth.value || !netWorth.value.accountBreakdown) return null
  return netWorth.value.accountBreakdown.map(acc => ({
    name: acc.name,
    balance: acc.balanceILS,
    balanceILS: acc.balanceILS
  }))
})

// Top categories
const topExpenseCategories = computed(() => {
  if (!analytics.value || !analytics.value.topExpenseCategories) return []
  return analytics.value.topExpenseCategories.slice(0, 10)
})

const topIncomeCategories = computed(() => {
  if (!analytics.value || !analytics.value.topIncomeCategories) return []
  return analytics.value.topIncomeCategories.slice(0, 10)
})

// Year-over-Year computed properties
const previousStartDate = computed(() => {
  if (!startDate.value) return null
  const start = new Date(startDate.value)
  start.setFullYear(start.getFullYear() - 1)
  return format(start, 'yyyy-MM-dd')
})

const previousEndDate = computed(() => {
  if (!endDate.value) return null
  const end = new Date(endDate.value)
  end.setFullYear(end.getFullYear() - 1)
  return format(end, 'yyyy-MM-dd')
})

const yoyChange = computed(() => {
  if (!analytics.value || !previousAnalytics.value) {
    return { income: 0, expenses: 0, net: 0 }
  }
  
  const currentIncome = analytics.value.totalIncome || 0
  const previousIncome = previousAnalytics.value.totalIncome || 0
  const currentExpenses = analytics.value.totalExpense || analytics.value.totalExpenses || 0
  const previousExpenses = previousAnalytics.value.totalExpense || previousAnalytics.value.totalExpenses || 0
  const currentNet = analytics.value.netBalance || 0
  const previousNet = previousAnalytics.value.netBalance || 0
  
  return {
    income: previousIncome > 0 ? ((currentIncome - previousIncome) / previousIncome) * 100 : 0,
    expenses: previousExpenses > 0 ? ((currentExpenses - previousExpenses) / previousExpenses) * 100 : 0,
    net: previousNet !== 0 ? ((currentNet - previousNet) / Math.abs(previousNet)) * 100 : 0
  }
})

const getPeriodLabel = (period) => {
  switch (period) {
    case 'MONTHLY': return 'This Month'
    case 'WEEKLY': return 'This Week'
    case 'DAILY': return 'Today'
    case 'YEARLY': return 'This Year'
    default: return period
  }
}

// Report helper methods
const formatDateRange = (start, end) => {
  if (!start || !end) return 'All Time'
  try {
    const startDate = new Date(start)
    const endDate = new Date(end)
    return `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`
  } catch {
    return `${start} - ${end}`
  }
}

const formatChange = (percentage) => {
  if (percentage === 0) return '0%'
  const sign = percentage > 0 ? '+' : ''
  return `${sign}${percentage.toFixed(1)}%`
}

const getChangeClass = (percentage) => {
  if (percentage > 0) return 'positive'
  if (percentage < 0) return 'negative'
  return ''
}

const loadRecurringData = async () => {
  try {
    const data = await analyticsService.getRecurring(startDate.value, endDate.value)
    recurringData.value = data.recurring || []
  } catch (err) {
    console.error('Error loading recurring data:', err)
    recurringData.value = []
  }
}

const loadAccountSummary = async () => {
  try {
    const accounts = await accountService.getAccounts()
    const accountList = accounts.accounts || []
    
    if (!analytics.value || !analytics.value.transactions) {
      accountSummary.value = []
      return
    }
    
    const transactions = analytics.value.transactions || []
    const summary = accountList.map(account => {
      const accountTransactions = transactions.filter(t => t.account === account.name)
      const income = accountTransactions
        .filter(t => t.type === 'Income')
        .reduce((sum, t) => sum + (t.convertedAmount || 0), 0)
      const expenses = accountTransactions
        .filter(t => t.type === 'Expense')
        .reduce((sum, t) => sum + Math.abs(t.convertedAmount || 0), 0)
      const transfers = accountTransactions
        .filter(t => t.type === 'Transfer')
        .reduce((sum, t) => sum + (t.convertedAmount || 0), 0)
      
      return {
        name: account.name,
        currency: account.currency || 'ILS',
        income,
        expenses,
        transfers,
        netChange: income - expenses + transfers,
        balance: parseFloat(account.balance) || 0,
        transactionCount: accountTransactions.length
      }
    })
    
    accountSummary.value = summary
  } catch (err) {
    console.error('Error loading account summary:', err)
    accountSummary.value = []
  }
}

const loadPreviousPeriodData = async () => {
  if (!previousStartDate.value || !previousEndDate.value) {
    previousAnalytics.value = null
    return
  }
  
  try {
    const data = await analyticsService.getAnalytics(previousStartDate.value, previousEndDate.value)
    previousAnalytics.value = data
  } catch (err) {
    console.error('Error loading previous period data:', err)
    previousAnalytics.value = null
  }
}

// Calculate forecast data with trends
const calculateForecastData = () => {
  if (!analytics.value || !predictions.value) {
    forecastData.value = {}
    return
  }
  
  const currentNet = analytics.value.netBalance || 0
  const currentIncome = analytics.value.totalIncome || 0
  const currentExpense = analytics.value.totalExpense || analytics.value.totalExpenses || 0
  
  // Next 7 days forecast (extrapolate from daily average)
  const dailyAvg = currentExpense / Math.max(1, analytics.value.dateRange?.days || 30)
  const next7Days = {
    income: (currentIncome / Math.max(1, analytics.value.dateRange?.days || 30)) * 7,
    expense: dailyAvg * 7,
    net: ((currentIncome - currentExpense) / Math.max(1, analytics.value.dateRange?.days || 30)) * 7,
    trend: currentNet > 0 ? 'up' : 'down',
    changePercent: 0
  }
  next7Days.net = next7Days.income - next7Days.expense
  
  // Next month forecast
  const nextMonth = predictions.value.nextMonth || predictions.value.nextMonthForecast || {}
  const nextMonthNet = nextMonth.net || nextMonth.netBalance || 0
  const nextMonthChange = currentNet !== 0 ? ((nextMonthNet - currentNet) / Math.abs(currentNet)) * 100 : 0
  
  // Next 3 months forecast
  const next3Months = predictions.value.next3Months || predictions.value.threeMonth || {}
  const next3MonthsNet = next3Months.net || next3Months.netBalance || 0
  const next3MonthsChange = currentNet !== 0 ? ((next3MonthsNet - currentNet) / Math.abs(currentNet)) * 100 : 0
  
  // Next year forecast
  const nextYear = predictions.value.nextYear || {}
  const nextYearNet = nextYear.net || 0
  const nextYearChange = currentNet !== 0 ? ((nextYearNet - currentNet) / Math.abs(currentNet)) * 100 : 0
  
  forecastData.value = {
    next7Days: {
      ...next7Days,
      changePercent: next7Days.net !== 0 ? ((next7Days.net - (currentNet / Math.max(1, analytics.value.dateRange?.days || 30) * 7)) / Math.abs(currentNet / Math.max(1, analytics.value.dateRange?.days || 30) * 7)) * 100 : 0
    },
    nextMonth: {
      income: nextMonth.income || 0,
      expense: nextMonth.expense || 0,
      net: nextMonthNet,
      trend: nextMonthChange > 5 ? 'up' : nextMonthChange < -5 ? 'down' : 'stable',
      changePercent: nextMonthChange
    },
    next3Months: {
      income: next3Months.income || 0,
      expense: next3Months.expense || 0,
      net: next3MonthsNet,
      trend: next3MonthsChange > 10 ? 'up' : next3MonthsChange < -10 ? 'down' : 'stable',
      changePercent: next3MonthsChange
    },
    nextYear: {
      income: nextYear.income || 0,
      expense: nextYear.expense || 0,
      net: nextYearNet,
      trend: nextYearChange > 20 ? 'up' : nextYearChange < -20 ? 'down' : 'stable',
      changePercent: nextYearChange
    }
  }
}

// Generate spending predictions
const generateSpendingPredictions = () => {
  if (!analytics.value) {
    spendingPredictions.value = []
    return
  }
  
  const predictions = []
  const dailyAvg = analytics.value.dailyAverages?.expense || 0
  const totalExpense = analytics.value.totalExpense || analytics.value.totalExpenses || 0
  const daysInPeriod = analytics.value.dateRange?.days || 30
  
  // Prediction 1: Monthly spending projection
  if (dailyAvg > 0) {
    const monthlyProjection = dailyAvg * 30
    predictions.push({
      icon: '📅',
      title: 'Monthly Spending Projection',
      description: `Based on current daily average of ${formatCurrency(dailyAvg)}/day`,
      amount: monthlyProjection,
      confidence: daysInPeriod >= 20 ? 85 : daysInPeriod >= 10 ? 70 : 50
    })
  }
  
  // Prediction 2: Category trends
  if (analytics.value.topExpenseCategories && analytics.value.topExpenseCategories.length > 0) {
    const topCategory = analytics.value.topExpenseCategories[0]
    const categoryName = Array.isArray(topCategory) ? topCategory[0] : topCategory.name || topCategory.category
    const categoryAmount = Array.isArray(topCategory) ? topCategory[1] : topCategory.amount || topCategory.total
    const monthlyCategory = (categoryAmount / daysInPeriod) * 30
    
    predictions.push({
      icon: '📊',
      title: `${categoryName} Monthly Forecast`,
      description: `Your top spending category projected monthly`,
      amount: monthlyCategory,
      confidence: 75
    })
  }
  
  // Prediction 3: Savings rate projection
  const savingsRate = analytics.value.totalIncome > 0 ? 
    ((analytics.value.netBalance || 0) / analytics.value.totalIncome) * 100 : 0
  if (savingsRate > 0) {
    const monthlySavings = (analytics.value.netBalance || 0) / daysInPeriod * 30
    predictions.push({
      icon: '💰',
      title: 'Monthly Savings Projection',
      description: `Based on current savings rate of ${savingsRate.toFixed(1)}%`,
      amount: monthlySavings,
      confidence: savingsRate > 10 ? 80 : 60
    })
  }
  
  // Prediction 4: Spending velocity warning
  if (insights.value && insights.value.expenseVelocity) {
    const velocity = insights.value.expenseVelocity
    const monthlyFromVelocity = velocity * 30
    if (monthlyFromVelocity > totalExpense * 1.2) {
      predictions.push({
        icon: '⚠️',
        title: 'Spending Velocity Alert',
        description: 'Your spending velocity suggests higher monthly spending',
        amount: monthlyFromVelocity,
        confidence: 65
      })
    }
  }
  
  spendingPredictions.value = predictions
}

// Get forecast class for styling
const getForecastClass = (value) => {
  if (!value) return ''
  return value >= 0 ? 'positive' : 'negative'
}

// Update category comparison
const updateCategoryComparison = () => {
  if (!analytics.value || !analytics.value.transactions || selectedComparisonCategories.value.length === 0) {
    categoryComparisonData.value = null
    return
  }
  
  const transactions = analytics.value.transactions || []
  const categoryData = {}
  
  // Group transactions by period and category
  transactions.forEach(t => {
    if (!t.dateIso || !selectedComparisonCategories.value.includes(t.category)) return
    
    const date = new Date(t.dateIso)
    let periodKey = ''
    
    if (comparisonPeriod.value === 'monthly') {
      periodKey = format(date, 'yyyy-MM')
    } else if (comparisonPeriod.value === 'weekly') {
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      periodKey = format(weekStart, 'yyyy-MM-dd')
    } else if (comparisonPeriod.value === 'quarterly') {
      const quarter = Math.floor(date.getMonth() / 3)
      periodKey = `${date.getFullYear()}-Q${quarter + 1}`
    }
    
    if (!categoryData[t.category]) {
      categoryData[t.category] = {}
    }
    if (!categoryData[t.category][periodKey]) {
      categoryData[t.category][periodKey] = 0
    }
    categoryData[t.category][periodKey] += Math.abs(t.convertedAmount || 0)
  })
  
  // Get all periods
  const allPeriods = new Set()
  Object.values(categoryData).forEach(periods => {
    Object.keys(periods).forEach(period => allPeriods.add(period))
  })
  const sortedPeriods = Array.from(allPeriods).sort()
  
  // Build chart data
  categoryComparisonData.value = {
    labels: sortedPeriods,
    datasets: selectedComparisonCategories.value.map((category, idx) => {
      const colors = ['#eb3349', '#f45c43', '#ff6b6b', '#ee5a6f', '#c44569', '#667eea', '#764ba2']
      return {
        label: category,
        data: sortedPeriods.map(period => categoryData[category]?.[period] || 0),
        borderColor: colors[idx % colors.length],
        backgroundColor: colors[idx % colors.length] + '40',
        tension: 0.4,
        fill: false
      }
    })
  }
}

// Load available categories for comparison
const loadAvailableCategories = () => {
  if (!analytics.value || !analytics.value.byCategory) {
    availableCategories.value = []
    return
  }
  
  availableCategories.value = Object.keys(analytics.value.byCategory)
    .filter(cat => (analytics.value.byCategory[cat] || 0) < 0) // Only expense categories
    .sort()
}

const exportReports = () => {
  // Create a comprehensive report object
  const report = {
    generatedAt: new Date().toISOString(),
    period: {
      start: startDate.value || 'All Time',
      end: endDate.value || 'All Time'
    },
    summary: {
      netWorth: netWorth.value?.totalNetWorth || 0,
      totalIncome: analytics.value?.totalIncome || 0,
      totalExpense: analytics.value?.totalExpense || analytics.value?.totalExpenses || 0,
      netBalance: analytics.value?.netBalance || 0,
      savingsRate: analytics.value?.totalIncome > 0 ? 
        (((analytics.value?.netBalance || 0) / analytics.value.totalIncome) * 100).toFixed(1) : 0
    },
    cashFlow: {
      inflow: analytics.value?.totalIncome || 0,
      outflow: analytics.value?.totalExpense || analytics.value?.totalExpenses || 0,
      net: analytics.value?.netBalance || 0
    },
    categories: {
      expenses: topExpenseCategories.value,
      income: topIncomeCategories.value
    },
    accounts: accountSummary.value,
    recurring: recurringData.value,
    budgets: budgetStatuses.value,
    insights: insights.value,
    forecasts: forecastData.value,
    predictions: spendingPredictions.value
  }
  
  // Convert to JSON and download
  const dataStr = JSON.stringify(report, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(dataBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = `financial-report-${format(new Date(), 'yyyy-MM-dd')}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const loadBudgetStatus = async () => {
  try {
    const data = await settingsService.getBudgetStatus()
    budgetStatuses.value = data.budgets || []
  } catch (err) {
    console.error('Error loading budget status:', err)
    budgetStatuses.value = []
  }
}

// Load loans and debts data
const loadLoansData = async () => {
  try {
    const params = {}
    if (startDate.value) params.startDate = startDate.value
    if (endDate.value) params.endDate = endDate.value
    
    const data = await analyticsService.getLoans(params.startDate, params.endDate)
    loansData.value = data
  } catch (err) {
    console.error('Error loading loans data:', err)
    loansData.value = null
  }
}

// Load expenses by person/company
const loadExpensesByPerson = async () => {
  try {
    const params = {}
    if (startDate.value) params.startDate = startDate.value
    if (endDate.value) params.endDate = endDate.value
    
    const data = await analyticsService.getExpensesByPerson(params.startDate, params.endDate)
    expensesByPerson.value = data || []
  } catch (err) {
    console.error('Error loading expenses by person:', err)
    expensesByPerson.value = []
  }
}

// Load debt by person (Debt category)
const loadDebtByPerson = async () => {
  try {
    const params = {}
    if (startDate.value) params.startDate = startDate.value
    if (endDate.value) params.endDate = endDate.value
    
    const data = await analyticsService.getDebtByPerson(params.startDate, params.endDate)
    debtByPerson.value = data || []
  } catch (err) {
    console.error('Error loading debt by person:', err)
    debtByPerson.value = []
  }
}

// Load advanced analytics with caching
const loadAdvancedAnalytics = async () => {
  if (loadingAdvanced.value) return
  
  loadingAdvanced.value = true
  try {
    const params = {}
    if (startDate.value) params.startDate = startDate.value
    if (endDate) params.endDate = endDate.value
    
    // Check cache first
    const cacheKey = `advanced-analytics-${JSON.stringify(params)}`
    const cached = cache.get(cacheKey, params)
    if (cached) {
      advancedAnalytics.value = cached
      spendingPatterns.value = cached.patterns
      merchants.value = cached.merchants || []
      cashFlowCalendar.value = cached.cashFlowCalendar || []
      healthScore.value = cached.healthScore
      spendingVelocity.value = cached.velocity
      aiInsights.value = cached.insights || []
      loadingAdvanced.value = false
      return
    }
    
    // Load from API
    const [advanced, patterns, merchantsData, calendar, health, velocity, insightsData] = await Promise.all([
      analyticsService.getAdvancedAnalytics(params.startDate, params.endDate).catch(() => null),
      analyticsService.getSpendingPatterns(params.startDate, params.endDate).catch(() => null),
      analyticsService.getMerchants(params.startDate, params.endDate).catch(() => []),
      analyticsService.getCashFlowCalendar(params.startDate, params.endDate).catch(() => []),
      analyticsService.getHealthScore(params.startDate, params.endDate).catch(() => null),
      analyticsService.getSpendingVelocity(params.startDate, params.endDate).catch(() => null),
      analyticsService.getAIInsights(params.startDate, params.endDate).catch(() => [])
    ])
    
    const result = {
      patterns: patterns || advanced?.patterns,
      merchants: merchantsData || advanced?.merchants || [],
      cashFlowCalendar: calendar || advanced?.cashFlowCalendar || [],
      healthScore: health || advanced?.healthScore,
      velocity: velocity || advanced?.velocity,
      insights: insightsData || advanced?.insights || []
    }
    
    // Cache for 5 minutes
    cache.set(cacheKey, result, params, 5 * 60 * 1000)
    
    advancedAnalytics.value = result
    spendingPatterns.value = result.patterns
    merchants.value = result.merchants
    cashFlowCalendar.value = result.cashFlowCalendar
    healthScore.value = result.healthScore
    spendingVelocity.value = result.velocity
    aiInsights.value = result.insights
  } catch (err) {
    console.error('Error loading advanced analytics:', err)
  } finally {
    loadingAdvanced.value = false
  }
}

const loadDashboardData = async () => {
  loading.value = true
  error.value = null
  
  try {
    const params = {}
    if (startDate.value) params.startDate = startDate.value
    if (endDate.value) params.endDate = endDate.value
    
    const [data, netWorthData] = await Promise.all([
      analyticsService.getData(params.startDate, params.endDate),
      calculateNetWorth()
    ])
    
    // Load budget status separately (doesn't depend on date filters)
    await Promise.all([
      loadBudgetStatus(),
      loadRecurringData(),
      loadPreviousPeriodData()
    ])
    
    analytics.value = data.analytics
    predictions.value = data.predictions
    tips.value = data.tips || []
    netWorth.value = netWorthData
    insights.value = calculateInsights()
    
    // Load account summary after analytics is set
    await loadAccountSummary()
    
    // Calculate advanced analytics
    calculateForecastData()
    generateSpendingPredictions()
    loadAvailableCategories()
    updateCategoryComparison()
    
    // Load advanced analytics in background (lazy load)
    if (showAdvancedAnalytics.value) {
      loadAdvancedAnalytics()
    }
    
    // Load loans and person-based analytics
    loadLoansData()
    loadExpensesByPerson()
    loadDebtByPerson()
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to load dashboard data'
    console.error('Dashboard error:', err)
  } finally {
    loading.value = false
  }
}

const getHealthScoreClass = (score) => {
  if (score >= 80) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 60) return 'fair'
  return 'poor'
}

// Watch for date changes and clear cache
watch([startDate, endDate], () => {
  cache.clearAll()
  loadLoansData()
  loadExpensesByPerson()
  loadDebtByPerson()
})

onMounted(() => {
  loadDashboardData()
  
  // Register background sync
  backgroundSync.register('dashboard', async () => {
    // Only sync if not currently loading and user is viewing dashboard
    if (!loading.value && document.visibilityState === 'visible') {
      // Refresh analytics in background (silent refresh)
      try {
        const params = {}
        if (startDate.value) params.startDate = startDate.value
        if (endDate.value) params.endDate = endDate.value
        
        const data = await analyticsService.getData(params.startDate, params.endDate)
        analytics.value = data.analytics
        predictions.value = data.predictions
        tips.value = data.tips || []
        insights.value = calculateInsights()
        calculateForecastData()
        generateSpendingPredictions()
        
        // Clear cache to force refresh
        cache.clearAll()
      } catch (err) {
        console.error('Background sync error:', err)
      }
    }
  }, 5 * 60 * 1000) // Sync every 5 minutes
  
  // Start background sync
  backgroundSync.start()
})

// Cleanup on unmount
onUnmounted(() => {
  backgroundSync.stop()
  backgroundSync.unregister('dashboard')
})
</script>

<style scoped>
.dashboard {
  padding: 24px 0;
}

.dashboard-header {
  margin-bottom: 24px;
}

.dashboard-header h1 {
  margin: 0 0 16px 0;
  color: var(--text-primary);
}

.header-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.quick-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.quick-filter-btn {
  padding: 8px 16px;
  border: 2px solid var(--input-border);
  border-radius: 8px;
  background: var(--input-bg);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.quick-filter-btn:hover {
  border-color: #667eea;
}

.quick-filter-btn.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.date-filters {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.date-input {
  padding: 8px 12px;
  border: 1px solid var(--input-border);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 14px;
}

/* Net Worth Card */
.net-worth-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 24px;
  border-radius: 12px;
  margin-bottom: 24px;
}

.net-worth-header {
  text-align: center;
  margin-bottom: 20px;
}

.net-worth-label {
  font-size: 1.2em;
  opacity: 0.9;
  margin-bottom: 10px;
}

.net-worth-value {
  font-size: 3.5em;
  font-weight: bold;
}

.account-breakdown-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
  margin-top: 20px;
}

.account-breakdown-item {
  background: rgba(255, 255, 255, 0.2);
  padding: 12px;
  border-radius: 8px;
  text-align: center;
}

.account-name {
  font-size: 0.85em;
  opacity: 0.9;
  margin-bottom: 5px;
}

.account-balance {
  font-size: 1.1em;
  font-weight: 600;
  margin-bottom: 3px;
}

.account-balance-ils {
  font-size: 0.75em;
  opacity: 0.8;
}

/* Stats Grid */
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

.stat-value.positive {
  color: var(--positive-color);
}

.stat-value.negative {
  color: var(--negative-color);
}

/* Insights Section */
.insights-section {
  margin-bottom: 24px;
}

.insights-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.health-score-card {
  color: white;
  padding: 25px;
  border-radius: 15px;
  text-align: center;
}

.health-score-label {
  font-size: 0.9em;
  opacity: 0.9;
  margin-bottom: 10px;
}

.health-score-value {
  font-size: 3.5em;
  font-weight: bold;
  margin-bottom: 10px;
}

.health-score-label-text {
  font-size: 1.1em;
  font-weight: 600;
}

.insight-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  border-radius: 15px;
}

.insight-label {
  font-size: 0.9em;
  opacity: 0.9;
  margin-bottom: 8px;
}

.insight-value {
  font-size: 2em;
  font-weight: bold;
  margin-bottom: 8px;
}

.insight-subtext {
  font-size: 0.85em;
  opacity: 0.9;
}

.insight-split {
  display: flex;
  justify-content: space-between;
  margin-top: 15px;
}

.split-item {
  text-align: center;
}

.split-label {
  font-size: 0.8em;
  opacity: 0.9;
  margin-bottom: 5px;
}

.split-value {
  font-size: 1.3em;
  font-weight: bold;
}

.day-breakdown, .key-insights {
  background: var(--card-bg);
  padding: 20px;
  border-radius: 12px;
  margin-top: 20px;
  border: 1px solid var(--border-color);
}

.day-breakdown h3, .key-insights h3 {
  margin: 0 0 16px 0;
  color: var(--text-primary);
}

.day-breakdown-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.day-item {
  margin-bottom: 15px;
}

.day-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
}

.day-name {
  font-weight: 600;
  color: var(--text-primary);
}

.day-amount {
  color: var(--negative-color);
  font-weight: 600;
}

.day-progress-bar {
  background: var(--border-color);
  border-radius: 10px;
  height: 8px;
  overflow: hidden;
  margin-bottom: 3px;
}

.day-progress-fill {
  background: linear-gradient(90deg, var(--negative-color), #f5576c);
  height: 100%;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.day-progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.3),
    transparent
  );
  animation: shimmer 2s infinite;
}

.day-percentage {
  font-size: 0.8em;
  color: var(--text-secondary);
}

.insights-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.insight-item {
  padding: 12px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 8px;
  color: var(--text-primary);
  line-height: 1.6;
}

[data-theme="dark"] .insight-item {
  background: rgba(22, 27, 34, 0.7);
  color: var(--text-primary);
}

/* Detailed Reports */
.detailed-reports {
  margin-bottom: 24px;
}

.reports-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.report-card {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  color: white;
  padding: 20px;
  border-radius: 15px;
}

.report-label {
  font-size: 0.9em;
  opacity: 0.9;
  margin-bottom: 8px;
}

.report-value {
  font-size: 2em;
  font-weight: bold;
}

/* Charts Section */
.charts-section {
  margin-bottom: 24px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.chart-period-switcher {
  display: flex;
  gap: 8px;
}

.chart-period-btn {
  padding: 6px 12px;
  border: 2px solid var(--input-border);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.chart-period-btn:hover {
  border-color: var(--link-color);
}

.chart-period-btn.active {
  background: var(--link-color);
  color: white;
  border-color: var(--link-color);
}

.two-column-charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 24px;
  margin-bottom: 24px;
}

/* Categories Tables */
.categories-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 16px;
}

.categories-table th {
  background: var(--bg-tertiary);
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: var(--text-primary);
  border-bottom: 2px solid var(--border-color);
}

.categories-table td {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
}

.categories-table td.positive {
  color: #28a745;
  font-weight: 600;
}

.categories-table td.negative {
  color: #dc3545;
  font-weight: 600;
}

/* Predictions */
.predictions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.prediction-card {
  background: var(--bg-tertiary);
  padding: 20px;
  border-radius: 12px;
  border-left: 4px solid #667eea;
}

.prediction-label {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.prediction-value {
  font-size: 24px;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.prediction-details {
  font-size: 12px;
  color: var(--text-secondary);
}

/* Enhanced Predictions & Forecasting */
.forecasting-section {
  margin-bottom: 32px;
}

.forecasting-section h3 {
  margin-bottom: 20px;
  color: var(--text-primary);
  font-size: 1.2em;
}

.forecast-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.forecast-card {
  background: var(--bg-tertiary);
  padding: 20px;
  border-radius: 12px;
  border-left: 4px solid var(--link-color);
  transition: transform 0.2s, box-shadow 0.2s;
}

.forecast-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--shadow);
}

.forecast-label {
  font-size: 0.9em;
  color: var(--text-secondary);
  margin-bottom: 12px;
  font-weight: 600;
}

.forecast-value {
  font-size: 2em;
  font-weight: bold;
  margin-bottom: 12px;
}

.forecast-trend {
  margin-bottom: 12px;
}

.trend-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 0.9em;
  font-weight: 600;
}

.trend-indicator.up {
  background: #e8f5e9;
  color: #2e7d32;
}

.trend-indicator.down {
  background: #ffebee;
  color: #c62828;
}

.trend-indicator.stable {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.forecast-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.9em;
  color: var(--text-secondary);
}

/* Spending Predictions */
.spending-predictions-section {
  margin-top: 32px;
  padding-top: 32px;
  border-top: 2px solid var(--border-color);
}

.spending-predictions-section h3 {
  margin-bottom: 20px;
  color: var(--text-primary);
  font-size: 1.2em;
}

.predictions-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.prediction-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  border-left: 4px solid var(--link-color);
  transition: transform 0.2s;
}

.prediction-item:hover {
  transform: translateX(4px);
}

.prediction-icon {
  font-size: 2em;
  flex-shrink: 0;
}

.prediction-content {
  flex: 1;
}

.prediction-title {
  font-weight: 600;
  font-size: 1.1em;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.prediction-description {
  font-size: 0.9em;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.prediction-amount {
  font-size: 1.3em;
  font-weight: bold;
  color: var(--text-primary);
}

.prediction-confidence {
  text-align: center;
  padding: 8px 12px;
  background: var(--card-bg);
  border-radius: 8px;
  min-width: 80px;
}

.confidence-label {
  font-size: 0.75em;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.confidence-value {
  font-size: 1.2em;
  font-weight: bold;
  color: var(--link-color);
}

/* Category Comparison */
.category-comparison-controls {
  display: flex;
  gap: 24px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.comparison-selector,
.comparison-period {
  flex: 1;
  min-width: 200px;
}

.comparison-selector label,
.comparison-period label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-primary);
}

.category-select {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--input-border);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 14px;
  min-height: 100px;
}

.category-select option {
  padding: 8px;
}

.comparison-period select {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--input-border);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 14px;
}

.category-comparison-chart {
  margin-top: 24px;
}

/* Tips */
.tips-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.tip-card {
  padding: 20px;
  border-radius: 10px;
  border-left: 5px solid;
  transition: all 0.3s;
  box-shadow: 0 2px 8px var(--shadow);
}

.tip-card.high {
  background: #ffebee;
  border-color: #eb3349;
}

.tip-card.medium {
  background: #f3e5f5;
  border-color: #f093fb;
}

.tip-card.low {
  background: #e3f2fd;
  border-color: #667eea;
}

.tip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.tip-title {
  font-weight: 600;
  font-size: 1.1em;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.tip-icon {
  font-size: 1.3em;
}

.tip-impact {
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 0.75em;
  font-weight: 600;
}

.tip-impact.high {
  background: #ffebee;
  color: #c62828;
}

.tip-impact.medium {
  background: #f3e5f5;
  color: #7b1fa2;
}

.tip-impact.low {
  background: #e3f2fd;
  color: #1565c0;
}

.tip-message {
  color: #555;
  line-height: 1.6;
  margin-bottom: 12px;
  font-size: 0.95em;
}

.tip-savings {
  background: rgba(17, 153, 142, 0.1);
  padding: 10px;
  border-radius: 8px;
  margin-top: 10px;
}

.tip-savings-label {
  font-size: 0.85em;
  color: #11998e;
  font-weight: 600;
  margin-bottom: 5px;
}

.tip-savings-value {
  font-size: 1.3em;
  font-weight: bold;
  color: #11998e;
}

/* Budget Alerts Section */
.budget-alerts-section {
  margin-bottom: 24px;
}

.info-box {
  background: var(--warning-bg);
  border-left: 4px solid #ff9800;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 0.85em;
  color: var(--text-secondary);
}

.no-budgets {
  text-align: center;
  padding: 40px;
  background: var(--bg-tertiary);
  border-radius: 8px;
}

.no-budgets-icon {
  font-size: 3em;
  margin-bottom: 15px;
}

.no-budgets-title {
  font-size: 1.1em;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 10px;
}

.no-budgets-text {
  font-size: 0.9em;
  color: var(--text-secondary);
  margin-bottom: 20px;
}

.budgets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 20px;
}

.budget-card {
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid;
  box-shadow: 0 2px 8px var(--shadow);
  transition: transform 0.2s;
}

.budget-card:hover {
  transform: translateY(-2px);
}

.budget-card.ok {
  background: #e8f5e9;
  border-color: #4caf50;
}

.budget-card.warning {
  background: var(--warning-bg);
  border-color: #ff9800;
}

.budget-card.exceeded {
  background: #ffebee;
  border-color: #f44336;
}

.budget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.budget-name {
  font-weight: 600;
  font-size: 1.1em;
  color: var(--text-primary);
}

.budget-status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.75em;
  font-weight: 600;
  text-transform: uppercase;
}

.budget-status-badge.ok {
  background: #4caf50;
  color: white;
}

.budget-status-badge.warning {
  background: #ff9800;
  color: white;
}

.budget-status-badge.exceeded {
  background: #f44336;
  color: white;
}

.budget-scope {
  font-size: 0.85em;
  color: var(--text-secondary);
  margin-bottom: 5px;
}

.budget-period {
  font-size: 0.85em;
  color: var(--text-secondary);
  margin-bottom: 15px;
  font-weight: 500;
}

.budget-progress {
  margin-bottom: 15px;
}

.budget-progress-bar {
  background: var(--border-color);
  border-radius: 10px;
  height: 12px;
  overflow: hidden;
  margin-bottom: 5px;
  position: relative;
}

.budget-progress-fill {
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  height: 100%;
}

.budget-progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.3),
    transparent
  );
  animation: shimmer 2s infinite;
}


.budget-progress-fill.ok {
  background: linear-gradient(90deg, #4caf50, #66bb6a);
}

.budget-progress-fill.warning {
  background: linear-gradient(90deg, #ff9800, #ffb74d);
}

.budget-progress-fill.exceeded {
  background: linear-gradient(90deg, #f44336, #ef5350);
}

/* Reports Section */
.reports-section {
  margin-top: 24px;
}

.reports-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.reports-header h2 {
  margin: 0;
}

.reports-actions {
  display: flex;
  gap: 12px;
}

.report-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 24px;
  border-bottom: 2px solid var(--border-color);
  padding-bottom: 8px;
}

.report-tab {
  padding: 10px 20px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  border-radius: 6px 6px 0 0;
  transition: all 0.3s ease;
  position: relative;
}

.report-tab:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.report-tab.active {
  color: var(--link-color);
  background: var(--bg-tertiary);
}

.report-tab.active::after {
  content: '';
  position: absolute;
  bottom: -10px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--link-color);
}

.report-content {
  animation: fadeIn 0.3s ease-out;
}

.report-title {
  margin-bottom: 24px;
}

.report-title h3 {
  margin: 0 0 8px 0;
  color: var(--text-primary);
}

.report-subtitle {
  color: var(--text-secondary);
  font-size: 0.9em;
  margin: 0;
}

/* Report Tips */
.report-tips {
  margin-bottom: 24px;
}

.tip-box {
  background: var(--info-bg);
  border-left: 4px solid var(--info-color);
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  animation: fadeIn 0.3s ease-out;
}

.tip-box strong {
  color: var(--info-text);
  display: block;
  margin-bottom: 12px;
  font-size: 1em;
}

.tip-box ul {
  margin: 0;
  padding-left: 20px;
  list-style-type: disc;
}

.tip-box li {
  margin-bottom: 8px;
  color: var(--text-primary);
  line-height: 1.6;
  font-size: 0.9em;
}

.tip-box li:last-child {
  margin-bottom: 0;
}

.tip-box li strong {
  display: inline;
  color: var(--info-text);
  font-weight: 600;
}

[data-theme="dark"] .tip-box {
  background: var(--info-bg);
  border-left-color: var(--info-color);
}

[data-theme="dark"] .tip-box strong,
[data-theme="dark"] .tip-box li strong {
  color: var(--info-text);
}

/* Mobile responsive for report tips */
@media (max-width: 768px) {
  .report-tips {
    margin-bottom: 16px;
  }
  
  .tip-box {
    padding: 12px;
    font-size: 0.9em;
  }
  
  .tip-box li {
    font-size: 0.85em;
    margin-bottom: 6px;
  }
  
  .tip-box strong {
    font-size: 0.95em;
    margin-bottom: 10px;
  }
}

@media (max-width: 480px) {
  .tip-box {
    padding: 10px;
  }
  
  .tip-box ul {
    padding-left: 18px;
  }
  
  .tip-box li {
    font-size: 0.8em;
    margin-bottom: 5px;
  }
}

/* Cash Flow Report */
.cashflow-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.cashflow-card {
  background: var(--bg-tertiary);
  padding: 20px;
  border-radius: 8px;
  text-align: center;
}

.cashflow-label {
  font-size: 0.9em;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.cashflow-value {
  font-size: 2em;
  font-weight: bold;
  margin-bottom: 8px;
}

.cashflow-detail {
  font-size: 0.85em;
  color: var(--text-secondary);
}

.cashflow-breakdown {
  margin-top: 24px;
}

.cashflow-breakdown h4 {
  margin-bottom: 16px;
  color: var(--text-primary);
}

.cashflow-table {
  overflow-x: auto;
}

.cashflow-table table {
  width: 100%;
  border-collapse: collapse;
}

.cashflow-table th,
.cashflow-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

.cashflow-table th {
  background: var(--bg-tertiary);
  font-weight: 600;
  color: var(--text-primary);
}

.type-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.85em;
  font-weight: 600;
}

.type-badge.income {
  background: #e8f5e9;
  color: #2e7d32;
}

.type-badge.expense {
  background: #ffebee;
  color: #c62828;
}

/* Category Performance Report */
.category-performance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 24px;
}

.performance-section h4 {
  margin-bottom: 16px;
  color: var(--text-primary);
}

.performance-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.performance-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 8px;
}

.performance-rank {
  font-weight: bold;
  color: var(--text-secondary);
  min-width: 30px;
}

.performance-info {
  flex: 1;
}

.performance-name {
  font-weight: 500;
  margin-bottom: 6px;
  color: var(--text-primary);
}

.performance-bar-container {
  width: 100%;
  height: 8px;
  background: var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}

.performance-bar {
  height: 100%;
  background: linear-gradient(90deg, #eb3349, #f45c43);
  border-radius: 4px;
  transition: width 0.6s ease;
}

.performance-bar.positive {
  background: linear-gradient(90deg, #11998e, #38ef7d);
}

.performance-amount {
  font-weight: 600;
  min-width: 100px;
  text-align: right;
}

/* Account Performance Report */
.account-summary-table {
  overflow-x: auto;
}

.account-summary-table table {
  width: 100%;
  border-collapse: collapse;
}

.account-summary-table th,
.account-summary-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

.account-summary-table th {
  background: var(--bg-tertiary);
  font-weight: 600;
  color: var(--text-primary);
}

/* Recurring Transactions Report */
.recurring-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.recurring-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  transition: transform 0.2s;
}

.recurring-item:hover {
  transform: translateX(4px);
}

.recurring-icon {
  font-size: 2em;
}

.recurring-info {
  flex: 1;
}

.recurring-name {
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--text-primary);
}

.recurring-details {
  display: flex;
  gap: 16px;
  font-size: 0.9em;
  color: var(--text-secondary);
}

.recurring-amount {
  font-size: 1.2em;
  font-weight: bold;
}

/* Spending Patterns Report */
.patterns-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}

.pattern-card {
  background: var(--bg-tertiary);
  padding: 20px;
  border-radius: 8px;
}

.pattern-card h4 {
  margin: 0 0 16px 0;
  color: var(--text-primary);
}

.day-breakdown-report {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.day-breakdown-item {
  display: grid;
  grid-template-columns: 100px 1fr 100px 60px;
  gap: 12px;
  align-items: center;
}

.day-name {
  font-weight: 500;
  color: var(--text-primary);
}

.day-bar-container {
  height: 8px;
  background: var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}

.day-bar {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 4px;
  transition: width 0.6s ease;
}

.day-amount {
  text-align: right;
  font-weight: 500;
}

.day-percentage {
  text-align: right;
  color: var(--text-secondary);
  font-size: 0.9em;
}

.month-split-report {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.split-item {
  padding: 16px;
  background: var(--card-bg);
  border-radius: 8px;
  border-left: 4px solid var(--link-color);
}

.split-label {
  font-size: 0.9em;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.split-value {
  font-size: 1.5em;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.split-percentage {
  font-size: 0.85em;
  color: var(--text-secondary);
}

.velocity-stats {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.velocity-item {
  padding: 12px;
  background: var(--card-bg);
  border-radius: 8px;
}

.velocity-label {
  font-size: 0.9em;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.velocity-value {
  font-size: 1.3em;
  font-weight: bold;
  color: var(--text-primary);
}

.velocity-subvalue {
  font-size: 0.9em;
  color: var(--text-secondary);
  margin-top: 4px;
}

/* Budget vs Actual Report */
.budget-vs-actual {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.budget-comparison-card {
  background: var(--bg-tertiary);
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid var(--border-color);
}

.budget-comparison-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.budget-comparison-name {
  font-weight: 600;
  font-size: 1.1em;
  color: var(--text-primary);
}

.budget-comparison-status {
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 0.85em;
  font-weight: 600;
}

.budget-comparison-status.ok {
  background: #e8f5e9;
  color: #2e7d32;
}

.budget-comparison-status.warning {
  background: var(--warning-bg);
  color: var(--warning-text);
}

.budget-comparison-status.exceeded {
  background: #ffebee;
  color: #c62828;
}

.budget-comparison-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.comparison-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.comparison-label {
  color: var(--text-secondary);
  font-size: 0.9em;
}

.comparison-value {
  font-weight: 600;
  color: var(--text-primary);
}

.budget-comparison-progress {
  height: 12px;
  background: var(--border-color);
  border-radius: 6px;
  overflow: hidden;
}

.budget-comparison-bar {
  height: 100%;
  border-radius: 6px;
  transition: width 0.6s ease;
}

.budget-comparison-bar.ok {
  background: linear-gradient(90deg, #4caf50, #66bb6a);
}

.budget-comparison-bar.warning {
  background: linear-gradient(90deg, #ff9800, #ffb74d);
}

.budget-comparison-bar.exceeded {
  background: linear-gradient(90deg, #f44336, #ef5350);
}

/* Year-over-Year Report */
.yoy-comparison {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}

.yoy-card {
  background: var(--bg-tertiary);
  padding: 24px;
  border-radius: 8px;
  border: 2px solid var(--border-color);
}

.yoy-card.yoy-change {
  border-color: var(--link-color);
  background: var(--card-bg);
}

.yoy-label {
  font-size: 0.9em;
  color: var(--text-secondary);
  margin-bottom: 8px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.yoy-period {
  font-size: 0.85em;
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.yoy-stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.yoy-stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color);
}

.yoy-stat:last-child {
  border-bottom: none;
}

.yoy-stat-label {
  color: var(--text-secondary);
  font-size: 0.9em;
}

.yoy-stat-value {
  font-weight: 600;
  font-size: 1.1em;
}

.budget-percentage {
  font-size: 0.85em;
  color: var(--text-secondary);
  text-align: right;
  font-weight: 600;
}

.budget-amounts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 15px;
}

.budget-amount-item {
  display: flex;
  flex-direction: column;
}

.budget-amount-label {
  font-size: 0.85em;
  color: var(--text-secondary);
  margin-bottom: 3px;
}

.budget-amount-value {
  font-size: 1.1em;
  font-weight: 600;
  color: var(--text-primary);
}

.budget-amount-value.positive {
  color: #4caf50;
}

.budget-amount-value.negative {
  color: #f44336;
}

.budget-limit {
  padding-top: 10px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.budget-limit-label {
  font-size: 0.85em;
  color: var(--text-secondary);
}

.budget-limit-value {
  font-size: 1em;
  font-weight: 600;
  color: var(--text-primary);
}

/* Advanced Analytics Styles */
.advanced-analytics-section {
  margin-top: 24px;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e0e0e0);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid var(--border-color, #e0e0e0);
}

.section-header h2 {
  margin: 0;
  color: var(--text-primary, #333);
  font-size: 24px;
  font-weight: 700;
}

.section-header .btn {
  padding: 10px 20px;
  font-weight: 600;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.section-header .btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.health-score-card {
  margin-bottom: 24px;
  padding: 24px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.health-score-card h3,
.velocity-card h3,
.ai-insights-card h3,
.patterns-section h3,
.calendar-section h3,
.merchants-section h3,
.sankey-section h3 {
  margin: 0;
  font-size: 20px;
  color: var(--text-primary, #333);
  font-weight: 600;
}

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  gap: 12px;
}

.info-tooltip {
  position: relative;
  display: inline-block;
  cursor: help;
}

.info-icon {
  font-size: 18px;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.info-tooltip:hover .info-icon {
  opacity: 1;
}

.tooltip-content {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  padding: 16px;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 320px;
  max-width: 400px;
  z-index: 1000;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-10px);
  transition: all 0.3s ease;
  font-size: 13px;
  line-height: 1.6;
}

.info-tooltip:hover .tooltip-content {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.tooltip-content strong {
  display: block;
  margin-bottom: 8px;
  color: var(--text-primary, #333);
  font-size: 14px;
}

.tooltip-content ul {
  margin: 8px 0 0 0;
  padding-left: 20px;
  color: var(--text-secondary, #666);
}

.tooltip-content li {
  margin-bottom: 6px;
}

.tooltip-content li strong {
  display: inline;
  margin: 0;
  color: var(--text-primary, #333);
}

.health-score-display {
  display: flex;
  gap: 32px;
  align-items: center;
}

.score-circle {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 5px solid;
  font-weight: bold;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: transform 0.3s ease;
}

.score-circle:hover {
  transform: scale(1.05);
}

.score-circle.excellent {
  border-color: #28a745;
  background: linear-gradient(135deg, rgba(40, 167, 69, 0.15) 0%, rgba(40, 167, 69, 0.05) 100%);
  color: #28a745;
}

.score-circle.good {
  border-color: #17a2b8;
  background: linear-gradient(135deg, rgba(23, 162, 184, 0.15) 0%, rgba(23, 162, 184, 0.05) 100%);
  color: #17a2b8;
}

.score-circle.fair {
  border-color: #ffc107;
  background: linear-gradient(135deg, rgba(255, 193, 7, 0.15) 0%, rgba(255, 193, 7, 0.05) 100%);
  color: #ff9800;
}

.score-circle.poor {
  border-color: #dc3545;
  background: linear-gradient(135deg, rgba(220, 53, 69, 0.15) 0%, rgba(220, 53, 69, 0.05) 100%);
  color: #dc3545;
}

.score-value {
  font-size: 36px;
  line-height: 1;
}

.score-grade {
  font-size: 18px;
  margin-top: 4px;
}

.score-breakdown {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.breakdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.breakdown-item:hover {
  border-color: rgba(102, 126, 234, 0.5);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transform: translateX(4px);
}

.breakdown-item .label {
  color: var(--text-secondary, #666);
  font-size: 14px;
}

.breakdown-item .value {
  font-weight: 600;
  color: var(--text-primary, #333);
  font-size: 15px;
}

.velocity-card {
  margin-bottom: 24px;
  padding: 24px;
  background: linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 152, 0, 0.1) 100%);
  border: 1px solid rgba(255, 193, 7, 0.2);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.velocity-card h3 {
  margin: 0 0 20px 0;
  font-size: 20px;
  color: var(--text-primary, #333);
  font-weight: 600;
}

.velocity-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.velocity-stat {
  padding: 20px;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 10px;
  text-align: center;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.velocity-stat:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  border-color: rgba(102, 126, 234, 0.3);
}

.velocity-stat .stat-label {
  font-size: 12px;
  color: var(--text-secondary, #666);
  margin-bottom: 8px;
}

.velocity-stat .stat-value {
  font-size: 18px;
  font-weight: bold;
  color: var(--text-primary, #333);
}

.velocity-stat .stat-value.accelerating {
  color: #dc3545;
}

.velocity-stat .stat-value.decelerating {
  color: #28a745;
}

.velocity-stat .stat-value.stable {
  color: #17a2b8;
}

.ai-insights-card {
  margin-bottom: 24px;
  padding: 24px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%);
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.ai-insights-card h3 {
  margin: 0 0 20px 0;
  font-size: 20px;
  color: var(--text-primary, #333);
  font-weight: 600;
}

.insights-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
}

.insight-item {
  padding: 20px;
  background: var(--card-bg, #ffffff);
  border-radius: 10px;
  border-left: 5px solid;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.insight-item:hover {
  transform: translateX(4px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.insight-item.high {
  border-left-color: #dc3545;
}

.insight-item.medium {
  border-left-color: #ffc107;
}

.insight-item.low {
  border-left-color: #17a2b8;
}

.insight-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.insight-type {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--text-secondary, #666);
  font-weight: 600;
}

.insight-impact {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 600;
  text-transform: uppercase;
}

.insight-impact.high {
  background: rgba(220, 53, 69, 0.1);
  color: #dc3545;
}

.insight-impact.medium {
  background: rgba(255, 193, 7, 0.1);
  color: #ffc107;
}

.insight-impact.low {
  background: rgba(23, 162, 184, 0.1);
  color: #17a2b8;
}

.insight-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #333);
  margin-bottom: 8px;
}

.insight-message {
  font-size: 14px;
  color: var(--text-secondary, #666);
  line-height: 1.5;
}

.insight-action {
  margin-top: 8px;
  padding: 8px;
  background: rgba(102, 126, 234, 0.1);
  border-radius: 4px;
  font-size: 13px;
  color: var(--text-primary, #333);
}

.patterns-section {
  margin-bottom: 24px;
}

.patterns-grid-container {
  width: 100%;
  overflow-x: auto;
  padding: 4px 0;
}

.patterns-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 24px;
  margin-top: 16px;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}

.pattern-card {
  padding: 24px;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.pattern-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: rgba(102, 126, 234, 0.3);
}

.heatmap-wrapper {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

.pattern-card h4 {
  margin: 0 0 20px 0;
  font-size: 18px;
  color: var(--text-primary, #333);
  font-weight: 600;
}

.calendar-section {
  margin-bottom: 24px;
}

.calendar-section h3 {
  margin: 0 0 20px 0;
  font-size: 20px;
  color: var(--text-primary, #333);
  font-weight: 600;
}

.merchants-section {
  margin-bottom: 24px;
  padding: 24px;
  background: linear-gradient(135deg, rgba(40, 167, 69, 0.08) 0%, rgba(23, 162, 184, 0.08) 100%);
  border: 1px solid rgba(40, 167, 69, 0.2);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.merchants-section h3 {
  margin: 0 0 20px 0;
  font-size: 20px;
  color: var(--text-primary, #333);
  font-weight: 600;
}

.merchants-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.merchant-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 10px;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.merchant-item:hover {
  transform: translateX(4px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  border-color: rgba(102, 126, 234, 0.3);
}

.merchant-rank {
  font-size: 18px;
  font-weight: bold;
  color: var(--text-secondary, #666);
  min-width: 40px;
}

.merchant-info {
  flex: 1;
}

.merchant-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #333);
  margin-bottom: 4px;
}

.merchant-details {
  font-size: 12px;
  color: var(--text-secondary, #666);
  display: flex;
  gap: 8px;
}

.merchant-amount {
  text-align: right;
}

.merchant-amount .spent {
  font-size: 16px;
  font-weight: 600;
  color: #dc3545;
}

.merchant-amount .received {
  font-size: 12px;
  color: #28a745;
  margin-top: 4px;
}

.sankey-section {
  margin-bottom: 24px;
}

.sankey-section h3 {
  margin: 0 0 20px 0;
  font-size: 20px;
  color: var(--text-primary, #333);
  font-weight: 600;
}

/* Dark mode support */
[data-theme="dark"] .health-score-card {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%);
  border-color: rgba(102, 126, 234, 0.3);
}

[data-theme="dark"] .velocity-card {
  background: linear-gradient(135deg, rgba(255, 193, 7, 0.15) 0%, rgba(255, 152, 0, 0.15) 100%);
  border-color: rgba(255, 193, 7, 0.3);
}

[data-theme="dark"] .ai-insights-card {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.12) 0%, rgba(118, 75, 162, 0.12) 100%);
  border-color: rgba(102, 126, 234, 0.3);
}

[data-theme="dark"] .merchants-section {
  background: linear-gradient(135deg, rgba(40, 167, 69, 0.12) 0%, rgba(23, 162, 184, 0.12) 100%);
  border-color: rgba(40, 167, 69, 0.3);
}

[data-theme="dark"] .breakdown-item,
[data-theme="dark"] .velocity-stat,
[data-theme="dark"] .insight-item,
[data-theme="dark"] .merchant-item,
[data-theme="dark"] .pattern-card {
  background: var(--card-bg, #1e1e1e);
  border-color: var(--border-color, #333);
}

/* Loading state for advanced analytics */
.advanced-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.advanced-loading p {
  margin-top: 20px;
  color: var(--text-secondary, #666);
  font-size: 16px;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid var(--border-color, #e0e0e0);
  border-top-color: var(--primary-color, #667eea);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .health-score-display {
    flex-direction: column;
  }
  
  .velocity-stats {
    grid-template-columns: 1fr;
  }
  
  .patterns-grid {
    grid-template-columns: 1fr;
    min-width: 100%;
  }
  
  .patterns-grid-container {
    overflow-x: visible;
  }
  
  .pattern-card {
    min-width: 100%;
    width: 100%;
  }
  
  .section-title-row {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .info-tooltip {
    align-self: flex-end;
  }
  
  .tooltip-content {
    right: auto;
    left: 0;
    min-width: 280px;
    max-width: calc(100vw - 40px);
  }
}

/* Loans & Debts Section */
.loans-section {
  margin-bottom: 24px;
  padding: 24px;
  background: linear-gradient(135deg, rgba(255, 152, 0, 0.08) 0%, rgba(255, 193, 7, 0.08) 100%);
  border: 1px solid rgba(255, 152, 0, 0.2);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.loans-section h3 {
  margin: 0 0 20px 0;
  font-size: 20px;
  color: var(--text-primary, #333);
  font-weight: 600;
}

.loans-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.summary-card {
  padding: 16px;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 10px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.summary-label {
  font-size: 12px;
  color: var(--text-secondary, #666);
  margin-bottom: 8px;
  text-transform: uppercase;
  font-weight: 600;
}

.summary-value {
  font-size: 20px;
  font-weight: bold;
  color: var(--text-primary, #333);
}

.summary-value.positive {
  color: #28a745;
}

.summary-value.negative {
  color: #dc3545;
}

.loans-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.loan-item {
  padding: 20px;
  background: var(--card-bg, #ffffff);
  border: 2px solid var(--border-color, #e0e0e0);
  border-radius: 10px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.loan-item:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.loan-item.repaid {
  border-left: 5px solid #28a745;
}

.loan-item.outstanding {
  border-left: 5px solid #dc3545;
}

.loan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.loan-person {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.loan-person strong {
  font-size: 18px;
  color: var(--text-primary, #333);
}

.loan-status {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 600;
  text-transform: uppercase;
  display: inline-block;
}

.status-repaid {
  background: rgba(40, 167, 69, 0.1);
  color: #28a745;
}

.status-outstanding {
  background: rgba(220, 53, 69, 0.1);
  color: #dc3545;
}

.loan-outstanding {
  font-size: 24px;
  font-weight: bold;
}

.loan-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.loan-detail-item {
  display: flex;
  justify-content: space-between;
  padding: 8px;
  background: var(--input-bg, #f5f5f5);
  border-radius: 6px;
}

.loan-detail-item .label {
  font-size: 12px;
  color: var(--text-secondary, #666);
}

.loan-detail-item .value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #333);
}

.loan-detail-item .value.positive {
  color: #28a745;
}

.loan-transactions {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color, #e0e0e0);
}

.loan-transactions details {
  cursor: pointer;
}

.loan-transactions summary {
  font-weight: 600;
  color: var(--text-primary, #333);
  padding: 8px;
  border-radius: 6px;
  transition: background 0.2s ease;
}

.loan-transactions summary:hover {
  background: var(--input-bg, #f5f5f5);
}

.transactions-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.transaction-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: var(--input-bg, #f5f5f5);
  border-radius: 6px;
  font-size: 13px;
}

.transaction-item.income {
  border-left: 3px solid #28a745;
}

.transaction-item.expense {
  border-left: 3px solid #dc3545;
}

.tx-date {
  min-width: 100px;
  color: var(--text-secondary, #666);
}

.tx-description {
  flex: 1;
  color: var(--text-primary, #333);
}

.tx-amount {
  font-weight: 600;
  min-width: 100px;
  text-align: right;
}

.tx-amount.income {
  color: #28a745;
}

.tx-amount.expense {
  color: #dc3545;
}

.no-loans {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary, #666);
}

.no-loans .hint {
  margin-top: 16px;
  font-size: 14px;
  line-height: 1.6;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

[data-theme="dark"] .loans-section {
  background: linear-gradient(135deg, rgba(255, 152, 0, 0.12) 0%, rgba(255, 193, 7, 0.12) 100%);
  border-color: rgba(255, 152, 0, 0.3);
}

[data-theme="dark"] .summary-card,
[data-theme="dark"] .loan-item {
  background: var(--card-bg, #1e1e1e);
  border-color: var(--border-color, #333);
}

/* Expenses by Person Section */
.expenses-by-person-section {
  margin-bottom: 24px;
  padding: 24px;
  background: linear-gradient(135deg, rgba(220, 53, 69, 0.08) 0%, rgba(255, 107, 107, 0.08) 100%);
  border: 1px solid rgba(220, 53, 69, 0.2);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.expenses-by-person-section h3 {
  margin: 0 0 20px 0;
  font-size: 20px;
  color: var(--text-primary, #333);
  font-weight: 600;
}

.expenses-person-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.expense-person-item {
  padding: 20px;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 10px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.expense-person-item:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.expense-person-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.expense-person-name {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.expense-person-name strong {
  font-size: 18px;
  color: var(--text-primary, #333);
}

.expense-count {
  font-size: 12px;
  color: var(--text-secondary, #666);
}

.expense-person-total {
  font-size: 24px;
  font-weight: bold;
}

.expense-categories {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.expense-category-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--input-bg, #f5f5f5);
  border-radius: 6px;
  font-size: 14px;
}

.category-name {
  color: var(--text-secondary, #666);
}

.category-amount {
  font-weight: 600;
  color: var(--text-primary, #333);
}

/* Debt by Person Section */
.debt-by-person-section {
  margin-bottom: 24px;
  padding: 24px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%);
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.debt-by-person-section h3 {
  margin: 0 0 20px 0;
  font-size: 20px;
  color: var(--text-primary, #333);
  font-weight: 600;
}

.debt-person-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.debt-person-item {
  padding: 20px;
  background: var(--card-bg, #ffffff);
  border: 2px solid var(--border-color, #e0e0e0);
  border-radius: 10px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.debt-person-item:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.debt-person-item.repaid {
  border-left: 5px solid #28a745;
}

.debt-person-item.outstanding {
  border-left: 5px solid #dc3545;
}

.debt-person-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.debt-person-name {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.debt-person-name strong {
  font-size: 18px;
  color: var(--text-primary, #333);
}

.debt-net {
  font-size: 24px;
  font-weight: bold;
}

.debt-breakdown {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.debt-breakdown-item {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  background: var(--input-bg, #f5f5f5);
  border-radius: 6px;
}

.debt-breakdown-item .label {
  font-size: 13px;
  color: var(--text-secondary, #666);
}

.debt-breakdown-item .value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #333);
}

[data-theme="dark"] .expenses-by-person-section {
  background: linear-gradient(135deg, rgba(220, 53, 69, 0.12) 0%, rgba(255, 107, 107, 0.12) 100%);
  border-color: rgba(220, 53, 69, 0.3);
}

[data-theme="dark"] .debt-by-person-section {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.12) 0%, rgba(118, 75, 162, 0.12) 100%);
  border-color: rgba(102, 126, 234, 0.3);
}

[data-theme="dark"] .expense-person-item,
[data-theme="dark"] .debt-person-item {
  background: var(--card-bg, #1e1e1e);
  border-color: var(--border-color, #333);
}

@media (max-width: 768px) {
  .loans-summary {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .loan-details {
    grid-template-columns: 1fr;
  }
  
  .loan-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .transaction-item {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .tx-amount {
    text-align: left;
  }
}
</style>

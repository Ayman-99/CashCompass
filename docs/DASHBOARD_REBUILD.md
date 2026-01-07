# Dashboard Rebuild Plan

The legacy dashboard has extensive features that need to be implemented:

## Core Features to Implement

1. **Net Worth Calculation**

   - Calculate from all accounts with `convertToILS=true`
   - Display total net worth prominently
   - Show account breakdown

2. **Financial Health Score (0-100)**

   - Calculate based on savings rate, expense diversity, transaction frequency, net worth, spending consistency
   - Display with color coding (green/yellow/red)
   - Show health label (Excellent/Good/Needs Improvement)

3. **Multiple Charts**

   - Monthly trends with period switching (Daily/Weekly/Monthly)
   - Category spending over time
   - Period comparison (current vs previous)
   - Expense categories breakdown (doughnut)
   - Income categories breakdown (doughnut)
   - Account distribution (doughnut)

4. **Financial Insights**

   - Spending velocity (per day)
   - Top spending day
   - Month split (1st half vs 2nd half)
   - Spending by day of week breakdown
   - Key insights list

5. **Detailed Reports**

   - Average daily income
   - Average daily expense
   - Savings rate
   - Total categories count
   - Income/Expense breakdowns

6. **Top Categories Tables**

   - Top 10 expense categories
   - Top 10 income categories

7. **Account Summary Table**

   - Income, Expense, Transfers, Balance, Transaction count per account

8. **Quick Filters**

   - All Time, This Month, Last 3 Months, This Year
   - Custom date range

9. **Display Currency Selector**
   - Allow switching display currency

## Implementation Strategy

Given the complexity, I'll create a comprehensive Dashboard.vue that includes all these features. The file will be large but well-organized with sections.

## Next Steps

1. Create comprehensive Dashboard.vue with all features
2. Add helper functions for calculations (net worth, health score, insights)
3. Create additional chart components if needed
4. Test all features

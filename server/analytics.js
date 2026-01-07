const fs = require('fs');
const path = require('path');

// Read and parse CSV
function parseCSV(filePath) {
  const data = fs.readFileSync(filePath, 'utf8');
  const lines = data.split('\n').filter(line => line.trim());
  
  const transactions = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(';');
    if (values.length < 8) continue;
    
    const transaction = {
      dateIso: values[0] || '',
      date: values[1] || '',
      account: values[2] || '',
      category: values[3] || '',
      subcategory: values[4] || '',
      amount: parseFloat((values[5] || '0').replace(/,/g, '')) || 0,
      currency: values[6] || '',
      convertedAmount: parseFloat((values[7] || '0').replace(/,/g, '')) || 0,
      type: values[8] || '',
      person: values[9] || '',
      description: values[10] || ''
    };
    
    transactions.push(transaction);
  }
  
  return transactions;
}

// Filter transactions by date range
function filterByDateRange(transactions, startDate, endDate) {
  if (!startDate && !endDate) return transactions;
  
  return transactions.filter(transaction => {
    if (!transaction.dateIso) return false;
    const transactionDate = transaction.dateIso.substring(0, 10); // Get YYYY-MM-DD part
    
    if (startDate && transactionDate < startDate) return false;
    if (endDate && transactionDate > endDate) return false;
    
    return true;
  });
}

// Calculate analytics
function calculateAnalytics(transactions, startDate = null, endDate = null) {
  // Filter transactions if date range provided
  const filteredTransactions = filterByDateRange(transactions, startDate, endDate);
  
  // Separate excluded transactions (categories with excludeFromReports = true)
  // Handle both boolean true and MySQL boolean 1
  const excludedTransactions = filteredTransactions.filter(t => {
    const excludeValue = t.excludeFromReports;
    const isExcluded = excludeValue === true || excludeValue === 1 || excludeValue === 'true' || excludeValue === '1';
    
    // Debug: log rent transactions
    if (t.category && (t.category.toLowerCase().includes('rent') || t.category.toLowerCase().includes('salary'))) {
      console.log('Transaction exclude check:', {
        category: t.category,
        excludeFromReports: excludeValue,
        isExcluded,
        type: typeof excludeValue,
        transaction: { id: t.id || 'N/A', amount: t.convertedAmount, date: t.dateIso }
      });
    }
    
    return isExcluded;
  });
  const regularTransactions = filteredTransactions.filter(t => {
    const excludeValue = t.excludeFromReports;
    return !(excludeValue === true || excludeValue === 1 || excludeValue === 'true' || excludeValue === '1');
  });
  
  console.log('Analytics separation:', {
    totalTransactions: filteredTransactions.length,
    excludedCount: excludedTransactions.length,
    regularCount: regularTransactions.length,
    excludedCategories: [...new Set(excludedTransactions.map(t => t.category).filter(Boolean))]
  });
  
  const analytics = {
    totalTransactions: filteredTransactions.length,
    totalIncome: 0,
    totalExpense: 0,
    totalTransfers: 0,
    netBalance: 0,
    // Excluded expenses tracking (for large fixed expenses like rent)
    excludedExpenses: 0,
    excludedIncome: 0,
    excludedTransactions: excludedTransactions.length,
    byCategory: {},
    byAccount: {},
    byMonth: {},
    byCurrency: {},
    currencyBreakdown: {},
    accountCurrencies: {},
    topExpenseCategories: {},
    topIncomeCategories: {},
    monthlyTrends: [],
    accountBalances: {},
    dateRange: { start: null, end: null },
    filteredDateRange: { start: startDate, end: endDate },
    dailyAverages: { income: 0, expense: 0 },
    transactions: regularTransactions // Only include regular transactions (exclude categories marked with excludeFromReports)
  };
  
  // Find actual date range from filtered transactions
  filteredTransactions.forEach(transaction => {
    if (transaction.dateIso) {
      if (!analytics.dateRange.start || transaction.dateIso < analytics.dateRange.start) {
        analytics.dateRange.start = transaction.dateIso;
      }
      if (!analytics.dateRange.end || transaction.dateIso > analytics.dateRange.end) {
        analytics.dateRange.end = transaction.dateIso;
      }
    }
  });
  
  // First, calculate excluded expenses/income separately
  excludedTransactions.forEach(transaction => {
    const amount = transaction.convertedAmount;
    const isTransfer = transaction.type === 'Transfer';
    
    if (!isTransfer) {
      if (transaction.type === 'Income') {
        analytics.excludedIncome += amount;
      } else if (transaction.type === 'Expense') {
        analytics.excludedExpenses += amount;
      }
    }
  });
  
  // Now process regular transactions (excluding those marked with excludeFromReports)
  regularTransactions.forEach(transaction => {
    const amount = transaction.convertedAmount;
    const month = transaction.dateIso ? transaction.dateIso.substring(0, 7) : 'Unknown';
    const isTransfer = transaction.type === 'Transfer';
    
    // Track transfers separately (they're just account movements, not real income/expense)
    if (isTransfer) {
      analytics.totalTransfers += amount;
    } else {
      // Only count non-transfers as real income/expense
      if (transaction.type === 'Income') {
        analytics.totalIncome += amount;
      } else if (transaction.type === 'Expense') {
        analytics.totalExpense += amount;
      }
    }
    
    if (transaction.category) {
      const key = `${transaction.category}${transaction.subcategory ? ' - ' + transaction.subcategory : ''}`;
      if (!analytics.byCategory[key]) {
        analytics.byCategory[key] = { income: 0, expense: 0 };
      }
      // Only count non-transfer categories in income/expense
      if (!isTransfer) {
        if (transaction.type === 'Income') {
          analytics.byCategory[key].income += amount;
        } else {
          analytics.byCategory[key].expense += amount;
        }
      }
      
      // Exclude transfers from top categories (only for regular transactions, not excluded ones)
      if (!isTransfer && !transaction.excludeFromReports) {
        if (transaction.type === 'Expense') {
          analytics.topExpenseCategories[transaction.category] = 
            (analytics.topExpenseCategories[transaction.category] || 0) + amount;
        } else {
          analytics.topIncomeCategories[transaction.category] = 
            (analytics.topIncomeCategories[transaction.category] || 0) + amount;
        }
      }
    }
    
    if (transaction.account) {
      if (!analytics.byAccount[transaction.account]) {
        analytics.byAccount[transaction.account] = { income: 0, expense: 0, transfers: 0, transactions: 0 };
      }
      
      // Track transfers separately (use absolute value for display)
      if (isTransfer) {
        analytics.byAccount[transaction.account].transfers += Math.abs(amount);
      } else {
        // Only count non-transfers in income/expense
        if (transaction.type === 'Income') {
          analytics.byAccount[transaction.account].income += amount;
        } else {
          analytics.byAccount[transaction.account].expense += amount;
        }
      }
      
      analytics.byAccount[transaction.account].transactions++;
      
      // Account balances still include transfers (money is moving between accounts)
      if (!analytics.accountBalances[transaction.account]) {
        analytics.accountBalances[transaction.account] = 0;
      }
      if (isTransfer) {
        // For transfers, use the amount directly (already negative for outgoing, positive for incoming)
        analytics.accountBalances[transaction.account] += amount;
      } else if (transaction.type === 'Income') {
        analytics.accountBalances[transaction.account] += amount;
      } else {
        analytics.accountBalances[transaction.account] -= amount;
      }
    }
    
    if (!analytics.byMonth[month]) {
      analytics.byMonth[month] = { income: 0, expense: 0, transfers: 0, transactions: 0 };
    }
    
    // Exclude transfers from monthly income/expense (only for regular transactions)
    if (isTransfer) {
      analytics.byMonth[month].transfers += Math.abs(amount);
    } else {
      if (transaction.type === 'Income') {
        analytics.byMonth[month].income += amount;
      } else {
        analytics.byMonth[month].expense += amount;
      }
    }
    analytics.byMonth[month].transactions++;
    
    if (transaction.currency) {
      // Track by original currency (not converted)
      if (!analytics.byCurrency[transaction.currency]) {
        analytics.byCurrency[transaction.currency] = { 
          income: 0, 
          expense: 0, 
          transfers: 0,
          incomeConverted: 0,
          expenseConverted: 0,
          transfersConverted: 0
        };
      }
      
      // Track currency breakdown (original amounts)
      if (!analytics.currencyBreakdown[transaction.currency]) {
        analytics.currencyBreakdown[transaction.currency] = {
          income: 0,
          expense: 0,
          transfers: 0,
          transactions: 0
        };
      }
      
      if (isTransfer) {
        analytics.byCurrency[transaction.currency].transfers += transaction.amount;
        analytics.byCurrency[transaction.currency].transfersConverted += transaction.convertedAmount;
        analytics.currencyBreakdown[transaction.currency].transfers += transaction.amount;
      } else {
        if (transaction.type === 'Income') {
          analytics.byCurrency[transaction.currency].income += transaction.amount;
          analytics.byCurrency[transaction.currency].incomeConverted += transaction.convertedAmount;
          analytics.currencyBreakdown[transaction.currency].income += transaction.amount;
        } else {
          analytics.byCurrency[transaction.currency].expense += transaction.amount;
          analytics.byCurrency[transaction.currency].expenseConverted += transaction.convertedAmount;
          analytics.currencyBreakdown[transaction.currency].expense += transaction.amount;
        }
      }
      
      analytics.currencyBreakdown[transaction.currency].transactions++;
      
      // Track currencies per account
      if (transaction.account) {
        if (!analytics.accountCurrencies[transaction.account]) {
          analytics.accountCurrencies[transaction.account] = {};
        }
        if (!analytics.accountCurrencies[transaction.account][transaction.currency]) {
          analytics.accountCurrencies[transaction.account][transaction.currency] = {
            balance: 0,
            income: 0,
            expense: 0,
            transfers: 0
          };
        }
        
        const accCurrency = analytics.accountCurrencies[transaction.account][transaction.currency];
        if (isTransfer) {
          accCurrency.transfers += transaction.amount;
        } else {
          if (transaction.type === 'Income') {
            accCurrency.income += transaction.amount;
            accCurrency.balance += transaction.amount;
          } else {
            accCurrency.expense += transaction.amount;
            accCurrency.balance -= transaction.amount;
          }
        }
      }
    }
    
    if (transaction.dateIso) {
      if (!analytics.dateRange.start || transaction.dateIso < analytics.dateRange.start) {
        analytics.dateRange.start = transaction.dateIso;
      }
      if (!analytics.dateRange.end || transaction.dateIso > analytics.dateRange.end) {
        analytics.dateRange.end = transaction.dateIso;
      }
    }
  });
  
  analytics.netBalance = analytics.totalIncome - analytics.totalExpense;
  
  // Calculate days between dates
  if (analytics.dateRange.start && analytics.dateRange.end) {
    const start = new Date(analytics.dateRange.start);
    const end = new Date(analytics.dateRange.end);
    const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    analytics.dailyAverages.income = analytics.totalIncome / days;
    analytics.dailyAverages.expense = analytics.totalExpense / days;
  }
  
  analytics.topExpenseCategories = Object.entries(analytics.topExpenseCategories)
    .sort((a, b) => b[1] - a[1]);
  
  analytics.topIncomeCategories = Object.entries(analytics.topIncomeCategories)
    .sort((a, b) => b[1] - a[1]);
  
  // Calculate currency conversion rates (average)
  Object.keys(analytics.byCurrency).forEach(currency => {
    const currencyData = analytics.byCurrency[currency];
    const totalOriginal = currencyData.income + currencyData.expense + currencyData.transfers;
    const totalConverted = currencyData.incomeConverted + currencyData.expenseConverted + currencyData.transfersConverted;
    if (totalOriginal > 0) {
      currencyData.conversionRate = totalConverted / totalOriginal;
    }
  });
  
  analytics.monthlyTrends = Object.entries(analytics.byMonth)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, data]) => ({
      month,
      income: data.income,
      expense: data.expense,
      transfers: data.transfers || 0,
      net: data.income - data.expense,
      transactions: data.transactions
    }));
  
  return analytics;
}

// Exponential smoothing for trend detection
function exponentialSmoothing(values, alpha = 0.3) {
  if (values.length === 0) return { smoothed: [], trend: 0 };
  if (values.length === 1) return { smoothed: values, trend: 0 };
  
  const smoothed = [values[0]];
  for (let i = 1; i < values.length; i++) {
    smoothed.push(alpha * values[i] + (1 - alpha) * smoothed[i - 1]);
  }
  
  // Calculate trend from smoothed values
  const trend = smoothed.length >= 2 
    ? (smoothed[smoothed.length - 1] - smoothed[smoothed.length - 2])
    : 0;
  
  return { smoothed, trend };
}

// Calculate standard deviation for confidence intervals
function calculateStdDev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

// Generate predictions with advanced algorithms
function generatePredictions(analytics) {
  const predictions = {
    nextMonth: { 
      income: 0, expense: 0, net: 0,
      incomeMin: 0, incomeMax: 0,
      expenseMin: 0, expenseMax: 0,
      confidence: 'low'
    },
    next3Months: { income: 0, expense: 0, net: 0 },
    nextYear: { income: 0, expense: 0, net: 0 },
    nextWeek: { income: 0, expense: 0, net: 0 },
    scenarios: {
      best: { income: 0, expense: 0, net: 0 },
      likely: { income: 0, expense: 0, net: 0 },
      worst: { income: 0, expense: 0, net: 0 }
    },
    categoryPredictions: {},
    savingsPotential: 0,
    monthsUntilZero: null,
    cashFlowProjection: [],
    dataQuality: 'insufficient'
  };
  
  const monthlyTrends = analytics.monthlyTrends || [];
  const hasEnoughData = monthlyTrends.length >= 2;
  
  if (!hasEnoughData) {
    // Use daily/weekly data if available for limited data scenarios
    const transactions = analytics.transactions || [];
    if (transactions.length > 0) {
      // Calculate from daily averages
      const daysWithData = Math.max(1, Math.ceil((new Date() - new Date(transactions[0].dateIso)) / (1000 * 60 * 60 * 24)));
      const dailyIncome = analytics.dailyAverages.income || 0;
      const dailyExpense = analytics.dailyAverages.expense || 0;
      
      predictions.nextWeek.income = dailyIncome * 7;
      predictions.nextWeek.expense = dailyExpense * 7;
      predictions.nextWeek.net = predictions.nextWeek.income - predictions.nextWeek.expense;
      
      predictions.nextMonth.income = dailyIncome * 30;
      predictions.nextMonth.expense = dailyExpense * 30;
      predictions.nextMonth.net = predictions.nextMonth.income - predictions.nextMonth.expense;
      
      predictions.dataQuality = 'limited';
      predictions.nextMonth.confidence = 'low';
      
      // Calculate months until zero
      if (predictions.nextMonth.expense > 0 && analytics.netBalance > 0) {
        predictions.monthsUntilZero = Math.ceil(analytics.netBalance / predictions.nextMonth.expense);
      }
      
      return predictions;
    }
    return predictions;
  }
  
  predictions.dataQuality = monthlyTrends.length >= 6 ? 'excellent' : monthlyTrends.length >= 3 ? 'good' : 'fair';
  
  // Use more months for better accuracy
  const monthsToUse = Math.min(6, monthlyTrends.length);
  const recentMonths = monthlyTrends.slice(-monthsToUse);
  
  // Extract values
  const incomeValues = recentMonths.map(m => m.income);
  const expenseValues = recentMonths.map(m => m.expense);
  
  // Calculate statistics
  const avgMonthlyIncome = incomeValues.reduce((sum, val) => sum + val, 0) / incomeValues.length;
  const avgMonthlyExpense = expenseValues.reduce((sum, val) => sum + val, 0) / expenseValues.length;
  
  // Calculate standard deviations for confidence intervals
  const incomeStdDev = calculateStdDev(incomeValues);
  const expenseStdDev = calculateStdDev(expenseValues);
  
  // Exponential smoothing for trend detection
  const incomeSmoothing = exponentialSmoothing(incomeValues, 0.3);
  const expenseSmoothing = exponentialSmoothing(expenseValues, 0.3);
  
  // Linear regression for trend
  let incomeTrend = 0;
  let expenseTrend = 0;
  if (recentMonths.length >= 2) {
    const months = recentMonths.map((_, i) => i);
    const incomeMean = incomeValues.reduce((a, b) => a + b, 0) / incomeValues.length;
    const expenseMean = expenseValues.reduce((a, b) => a + b, 0) / expenseValues.length;
    const monthMean = months.reduce((a, b) => a + b, 0) / months.length;
    
    let incomeNumerator = 0, incomeDenominator = 0;
    let expenseNumerator = 0, expenseDenominator = 0;
    
    months.forEach((month, i) => {
      incomeNumerator += (month - monthMean) * (incomeValues[i] - incomeMean);
      incomeDenominator += (month - monthMean) ** 2;
      expenseNumerator += (month - monthMean) * (expenseValues[i] - expenseMean);
      expenseDenominator += (month - monthMean) ** 2;
    });
    
    incomeTrend = incomeDenominator !== 0 ? incomeNumerator / incomeDenominator : 0;
    expenseTrend = expenseDenominator !== 0 ? expenseNumerator / expenseDenominator : 0;
  }
  
  // Combine exponential smoothing trend with linear regression
  const combinedIncomeTrend = (incomeSmoothing.trend * 0.4) + (incomeTrend * 0.6);
  const combinedExpenseTrend = (expenseSmoothing.trend * 0.4) + (expenseTrend * 0.6);
  
  // Base predictions
  const baseIncome = avgMonthlyIncome + combinedIncomeTrend;
  const baseExpense = avgMonthlyExpense + combinedExpenseTrend;
  
  // Confidence intervals (95% confidence using 2 standard deviations)
  const confidenceMultiplier = 1.96; // 95% confidence
  predictions.nextMonth.income = Math.max(0, baseIncome);
  predictions.nextMonth.incomeMin = Math.max(0, baseIncome - (incomeStdDev * confidenceMultiplier));
  predictions.nextMonth.incomeMax = baseIncome + (incomeStdDev * confidenceMultiplier);
  
  predictions.nextMonth.expense = Math.max(0, baseExpense);
  predictions.nextMonth.expenseMin = Math.max(0, baseExpense - (expenseStdDev * confidenceMultiplier));
  predictions.nextMonth.expenseMax = baseExpense + (expenseStdDev * confidenceMultiplier);
  
  predictions.nextMonth.net = predictions.nextMonth.income - predictions.nextMonth.expense;
  predictions.nextMonth.confidence = predictions.dataQuality === 'excellent' ? 'high' : 
                                     predictions.dataQuality === 'good' ? 'medium' : 'low';
  
  // Scenario planning
  predictions.scenarios.likely = {
    income: predictions.nextMonth.income,
    expense: predictions.nextMonth.expense,
    net: predictions.nextMonth.net
  };
  
  predictions.scenarios.best = {
    income: predictions.nextMonth.incomeMax,
    expense: predictions.nextMonth.expenseMin,
    net: predictions.nextMonth.incomeMax - predictions.nextMonth.expenseMin
  };
  
  predictions.scenarios.worst = {
    income: predictions.nextMonth.incomeMin,
    expense: predictions.nextMonth.expenseMax,
    net: predictions.nextMonth.incomeMin - predictions.nextMonth.expenseMax
  };
  
  // Extended predictions
  predictions.next3Months.income = predictions.nextMonth.income * 3;
  predictions.next3Months.expense = predictions.nextMonth.expense * 3;
  predictions.next3Months.net = predictions.next3Months.income - predictions.next3Months.expense;
  
  predictions.nextYear.income = predictions.nextMonth.income * 12;
  predictions.nextYear.expense = predictions.nextMonth.expense * 12;
  predictions.nextYear.net = predictions.nextYear.income - predictions.nextYear.expense;
  
  // Weekly predictions
  predictions.nextWeek.income = predictions.nextMonth.income / 4.33;
  predictions.nextWeek.expense = predictions.nextMonth.expense / 4.33;
  predictions.nextWeek.net = predictions.nextWeek.income - predictions.nextWeek.expense;
  
  // Category-specific predictions
  const topCategories = analytics.topExpenseCategories.slice(0, 5);
  topCategories.forEach(([category, totalAmount]) => {
    const months = monthlyTrends.length;
    const avgMonthly = totalAmount / months;
    
    // Find category trend if we have enough data
    const categoryMonths = monthlyTrends.map(month => {
      // This is simplified - in a real implementation, we'd track category spending per month
      return avgMonthly; // Placeholder
    });
    
    predictions.categoryPredictions[category] = {
      nextMonth: avgMonthly,
      trend: 'stable', // Could be 'increasing', 'decreasing', 'stable'
      confidence: months >= 3 ? 'medium' : 'low'
    };
  });
  
  // Cash flow projection (next 12 months)
  predictions.cashFlowProjection = [];
  let projectedBalance = analytics.netBalance;
  for (let i = 1; i <= 12; i++) {
    const monthIncome = baseIncome + (combinedIncomeTrend * i);
    const monthExpense = baseExpense + (combinedExpenseTrend * i);
    projectedBalance += (monthIncome - monthExpense);
    
    predictions.cashFlowProjection.push({
      month: i,
      income: monthIncome,
      expense: monthExpense,
      net: monthIncome - monthExpense,
      projectedBalance: projectedBalance
    });
  }
  
  // Calculate savings potential (identify categories that could be reduced)
  const discretionaryCategories = ['Food', 'Shopping', 'Entertainment', 'Wheels', 'Personal', 'Transport'];
  predictions.savingsPotential = discretionaryCategories.reduce((sum, cat) => {
    const categoryData = analytics.topExpenseCategories.find(([c]) => c === cat);
    if (categoryData) {
      const monthlyAvg = categoryData[1] / monthlyTrends.length;
      // 15-20% reduction potential for discretionary spending
      return sum + (monthlyAvg * 0.18);
    }
    return sum;
  }, 0);
  
  // Calculate months until balance reaches zero (if spending continues)
  if (predictions.nextMonth.expense > 0 && analytics.netBalance > 0) {
    predictions.monthsUntilZero = Math.ceil(analytics.netBalance / predictions.nextMonth.expense);
    
    // Also calculate with worst case scenario
    if (predictions.scenarios.worst.expense > 0) {
      predictions.monthsUntilZeroWorst = Math.ceil(analytics.netBalance / predictions.scenarios.worst.expense);
    }
  }
  
  return predictions;
}

// Generate savings tips
function generateSavingsTips(analytics) {
  const tips = [];
  
  // Analyze spending patterns
  const topExpense = analytics.topExpenseCategories[0];
  const foodSpending = analytics.topExpenseCategories.find(([cat]) => cat === 'Food')?.[1] || 0;
  const wheelsSpending = analytics.topExpenseCategories.find(([cat]) => cat === 'Wheels')?.[1] || 0;
  const shoppingSpending = analytics.topExpenseCategories.find(([cat]) => cat === 'Shopping')?.[1] || 0;
  const avgDailyExpense = analytics.dailyAverages.expense;
  const savingsRate = analytics.netBalance / analytics.totalIncome;
  
  // Tip 1: Overall savings rate
  if (savingsRate < 0.2) {
    tips.push({
      category: 'General',
      title: 'Increase Your Savings Rate',
      message: `You're currently saving ${(savingsRate * 100).toFixed(1)}% of your income. Aim for at least 20% to build a strong financial foundation.`,
      impact: 'High',
      potentialSavings: analytics.totalIncome * 0.2 - analytics.netBalance
    });
  }
  
  // Tip 2: Food spending
  if (foodSpending > 0) {
    const monthlyFood = foodSpending / (analytics.monthlyTrends.length || 1);
    if (monthlyFood > 500) {
      tips.push({
        category: 'Food',
        title: 'Optimize Food Spending',
        message: `You're spending ${monthlyFood.toFixed(0)} ILS/month on food. Consider meal planning, buying in bulk, and reducing restaurant visits to save 15-20%.`,
        impact: 'Medium',
        potentialSavings: foodSpending * 0.15
      });
    }
  }
  
  // Tip 3: Transportation
  if (wheelsSpending > 0) {
    const monthlyWheels = wheelsSpending / (analytics.monthlyTrends.length || 1);
    if (monthlyWheels > 200) {
      tips.push({
        category: 'Transportation',
        title: 'Review Transportation Costs',
        message: `Transportation costs are ${monthlyWheels.toFixed(0)} ILS/month. Consider carpooling, public transport, or walking for short distances.`,
        impact: 'Medium',
        potentialSavings: wheelsSpending * 0.1
      });
    }
  }
  
  // Tip 4: Shopping
  if (shoppingSpending > 0) {
    tips.push({
      category: 'Shopping',
      title: 'Reduce Impulse Purchases',
      message: `You've spent ${shoppingSpending.toFixed(0)} ILS on shopping. Try the 24-hour rule: wait a day before making non-essential purchases.`,
      impact: 'Low',
      potentialSavings: shoppingSpending * 0.2
    });
  }
  
  // Tip 5: Daily spending
  if (avgDailyExpense > 100) {
    tips.push({
      category: 'Daily Habits',
      title: 'Track Daily Spending',
      message: `Your average daily expense is ${avgDailyExpense.toFixed(0)} ILS. Small daily expenses add up quickly. Track every purchase for a week to identify unnecessary spending.`,
      impact: 'Medium',
      potentialSavings: avgDailyExpense * 0.15 * 30
    });
  }
  
  // Tip 6: Top expense category
  if (topExpense && topExpense[1] > analytics.totalExpense * 0.3) {
    tips.push({
      category: topExpense[0],
      title: `Focus on ${topExpense[0]} Spending`,
      message: `${topExpense[0]} accounts for ${((topExpense[1] / analytics.totalExpense) * 100).toFixed(1)}% of your expenses. Review this category for optimization opportunities.`,
      impact: 'High',
      potentialSavings: topExpense[1] * 0.1
    });
  }
  
  // Tip 7: Emergency fund
  if (analytics.netBalance > 0) {
    const monthsOfExpenses = analytics.netBalance / (analytics.totalExpense / (analytics.monthlyTrends.length || 1));
    if (monthsOfExpenses < 3) {
      tips.push({
        category: 'Emergency Fund',
        title: 'Build Emergency Fund',
        message: `You have ${monthsOfExpenses.toFixed(1)} months of expenses saved. Aim for 3-6 months of expenses as an emergency fund.`,
        impact: 'High',
        potentialSavings: 0
      });
    }
  }
  
  return tips.sort((a, b) => {
    const impactOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
    return impactOrder[b.impact] - impactOrder[a.impact];
  });
}

// Enhanced analytics - spending trends
function calculateSpendingTrends(analytics) {
  const trends = {
    dailyAverage: analytics.dailyAverages,
    weeklyAverage: {
      income: analytics.dailyAverages.income * 7,
      expense: analytics.dailyAverages.expense * 7
    },
    monthlyAverage: {
      income: 0,
      expense: 0
    },
    spendingVelocity: 0, // How fast you're spending (expense per day)
    burnRate: 0 // Days until balance reaches zero
  };
  
  if (analytics.monthlyTrends.length > 0) {
    const totalMonths = analytics.monthlyTrends.length;
    trends.monthlyAverage.income = analytics.totalIncome / totalMonths;
    trends.monthlyAverage.expense = analytics.totalExpense / totalMonths;
  }
  
  trends.spendingVelocity = analytics.dailyAverages.expense;
  
  if (trends.spendingVelocity > 0 && analytics.netBalance > 0) {
    trends.burnRate = Math.ceil(analytics.netBalance / trends.spendingVelocity);
  }
  
  return trends;
}

// Category spending over time
function calculateCategoryTrends(analytics) {
  const categoryTrends = {};
  
  // Group transactions by category and month
  analytics.transactions.forEach(transaction => {
    if (transaction.category && transaction.type === 'Expense' && transaction.category !== 'Transfer') {
      const month = transaction.dateIso ? transaction.dateIso.substring(0, 7) : 'Unknown';
      const category = transaction.category;
      
      if (!categoryTrends[category]) {
        categoryTrends[category] = {};
      }
      
      if (!categoryTrends[category][month]) {
        categoryTrends[category][month] = 0;
      }
      
      categoryTrends[category][month] += transaction.convertedAmount;
    }
  });
  
  // Convert to array format
  return Object.entries(categoryTrends).map(([category, months]) => ({
    category,
    monthlyData: Object.entries(months)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, amount]) => ({ month, amount }))
  }));
}

// Year-over-year comparison (if we have data from previous year)
function calculateYearOverYear(analytics) {
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;
  
  const currentYearData = { income: 0, expense: 0, transactions: 0 };
  const lastYearData = { income: 0, expense: 0, transactions: 0 };
  
  analytics.transactions.forEach(transaction => {
    if (!transaction.dateIso) return;
    const year = parseInt(transaction.dateIso.substring(0, 4));
    
    if (year === currentYear) {
      if (transaction.type === 'Income' && transaction.category !== 'Transfer') {
        currentYearData.income += transaction.convertedAmount;
      } else if (transaction.type === 'Expense' && transaction.category !== 'Transfer') {
        currentYearData.expense += transaction.convertedAmount;
      }
      currentYearData.transactions++;
    } else if (year === lastYear) {
      if (transaction.type === 'Income' && transaction.category !== 'Transfer') {
        lastYearData.income += transaction.convertedAmount;
      } else if (transaction.type === 'Expense' && transaction.category !== 'Transfer') {
        lastYearData.expense += transaction.convertedAmount;
      }
      lastYearData.transactions++;
    }
  });
  
  const comparison = {
    currentYear: currentYearData,
    lastYear: lastYearData,
    incomeChange: 0,
    expenseChange: 0,
    netChange: 0
  };
  
  if (lastYearData.income > 0) {
    comparison.incomeChange = ((currentYearData.income - lastYearData.income) / lastYearData.income) * 100;
  }
  if (lastYearData.expense > 0) {
    comparison.expenseChange = ((currentYearData.expense - lastYearData.expense) / lastYearData.expense) * 100;
  }
  
  comparison.netChange = (currentYearData.income - currentYearData.expense) - (lastYearData.income - lastYearData.expense);
  
  return comparison;
}

// Detect recurring transactions
function detectRecurringTransactions(transactions) {
  const recurring = [];
  const transactionGroups = {};
  
  // Group by description and category
  transactions.forEach(transaction => {
    if (transaction.category === 'Transfer' || !transaction.description) return;
    
    const key = `${transaction.category}|${transaction.description.toLowerCase().trim()}`;
    if (!transactionGroups[key]) {
      transactionGroups[key] = [];
    }
    transactionGroups[key].push(transaction);
  });
  
  // Find transactions that occur multiple times
  Object.entries(transactionGroups).forEach(([key, group]) => {
    if (group.length >= 2) {
      const amounts = group.map(t => t.convertedAmount);
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const amountVariance = amounts.every(a => Math.abs(a - avgAmount) / avgAmount < 0.1); // Within 10%
      
      // Sort by date
      group.sort((a, b) => a.dateIso.localeCompare(b.dateIso));
      
      // Calculate intervals
      const intervals = [];
      for (let i = 1; i < group.length; i++) {
        const date1 = new Date(group[i - 1].dateIso);
        const date2 = new Date(group[i].dateIso);
        const days = Math.round((date2 - date1) / (1000 * 60 * 60 * 24));
        intervals.push(days);
      }
      
      // Check if intervals are consistent (within 5 days variance)
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const isRegular = intervals.every(i => Math.abs(i - avgInterval) <= 5);
      
      if (amountVariance && isRegular) {
        // Get original amount (not converted) and currency from first transaction
        const originalAmount = group[0].amount;
        const currency = group[0].currency || 'ILS';
        recurring.push({
          category: group[0].category,
          description: group[0].description,
          amount: avgAmount, // Keep converted for sorting/comparison
          originalAmount: originalAmount, // Original amount in original currency
          currency: currency, // Original currency
          frequency: Math.round(avgInterval),
          frequencyType: avgInterval <= 7 ? 'weekly' : avgInterval <= 35 ? 'monthly' : 'other',
          count: group.length,
          lastDate: group[group.length - 1].dateIso,
          nextExpected: new Date(new Date(group[group.length - 1].dateIso).getTime() + avgInterval * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        });
      }
    }
  });
  
  return recurring.sort((a, b) => b.amount - a.amount);
}

// Filter transactions with advanced filters
function filterTransactions(transactions, filters) {
  let filtered = [...transactions];
  
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(t => 
      (t.description && t.description.toLowerCase().includes(searchLower)) ||
      (t.category && t.category.toLowerCase().includes(searchLower)) ||
      (t.account && t.account.toLowerCase().includes(searchLower)) ||
      (t.subcategory && t.subcategory.toLowerCase().includes(searchLower))
    );
  }
  
  if (filters.category && filters.category !== 'all') {
    filtered = filtered.filter(t => t.category === filters.category);
  }
  
  if (filters.account && filters.account !== 'all') {
    filtered = filtered.filter(t => t.account === filters.account);
  }
  
  if (filters.type && filters.type !== 'all') {
    filtered = filtered.filter(t => t.type === filters.type);
  }
  
  if (filters.minAmount !== null && filters.minAmount !== undefined) {
    filtered = filtered.filter(t => t.convertedAmount >= filters.minAmount);
  }
  
  if (filters.maxAmount !== null && filters.maxAmount !== undefined) {
    filtered = filtered.filter(t => t.convertedAmount <= filters.maxAmount);
  }
  
  if (filters.startDate) {
    filtered = filtered.filter(t => {
      if (!t.dateIso) return false;
      return t.dateIso.substring(0, 10) >= filters.startDate;
    });
  }
  
  if (filters.endDate) {
    filtered = filtered.filter(t => {
      if (!t.dateIso) return false;
      return t.dateIso.substring(0, 10) <= filters.endDate;
    });
  }
  
  return filtered;
}

// Calculate spending patterns (day of week, time of month)
function calculateSpendingPatterns(transactions) {
  const patterns = {
    byDayOfWeek: {
      Sunday: { income: 0, expense: 0, count: 0 },
      Monday: { income: 0, expense: 0, count: 0 },
      Tuesday: { income: 0, expense: 0, count: 0 },
      Wednesday: { income: 0, expense: 0, count: 0 },
      Thursday: { income: 0, expense: 0, count: 0 },
      Friday: { income: 0, expense: 0, count: 0 },
      Saturday: { income: 0, expense: 0, count: 0 }
    },
    byTimeOfMonth: {
      '1-7': { income: 0, expense: 0, count: 0 },
      '8-14': { income: 0, expense: 0, count: 0 },
      '15-21': { income: 0, expense: 0, count: 0 },
      '22-31': { income: 0, expense: 0, count: 0 }
    },
    byHour: Array(24).fill(0).map(() => ({ income: 0, expense: 0, count: 0 }))
  };

  transactions.forEach(transaction => {
    if (!transaction.dateIso || transaction.type === 'Transfer') return;
    
    const date = new Date(transaction.dateIso);
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
    const dayOfMonth = date.getDate();
    const hour = date.getHours();
    const amount = transaction.convertedAmount || 0;

    // Day of week
    if (transaction.type === 'Income') {
      patterns.byDayOfWeek[dayOfWeek].income += amount;
    } else if (transaction.type === 'Expense') {
      patterns.byDayOfWeek[dayOfWeek].expense += amount;
    }
    patterns.byDayOfWeek[dayOfWeek].count++;

    // Time of month
    let period;
    if (dayOfMonth <= 7) period = '1-7';
    else if (dayOfMonth <= 14) period = '8-14';
    else if (dayOfMonth <= 21) period = '15-21';
    else period = '22-31';

    if (transaction.type === 'Income') {
      patterns.byTimeOfMonth[period].income += amount;
    } else if (transaction.type === 'Expense') {
      patterns.byTimeOfMonth[period].expense += amount;
    }
    patterns.byTimeOfMonth[period].count++;

    // Hour of day
    if (transaction.type === 'Income') {
      patterns.byHour[hour].income += amount;
    } else if (transaction.type === 'Expense') {
      patterns.byHour[hour].expense += amount;
    }
    patterns.byHour[hour].count++;
  });

  return patterns;
}

// Merchant/vendor analysis
function analyzeMerchants(transactions) {
  const merchants = {};
  
  transactions.forEach(transaction => {
    if (transaction.type === 'Transfer' || !transaction.description) return;
    
    // Extract merchant name from description (simple heuristic)
    const description = transaction.description.toLowerCase();
    let merchant = transaction.personCompany || transaction.description;
    
    // Try to extract merchant from common patterns
    const patterns = [
      /^([A-Z][A-Z\s&]+?)\s/i,  // Capitalized words at start
      /at\s+([A-Z][A-Z\s&]+?)(?:\s|$)/i,  // "at MERCHANT"
      /from\s+([A-Z][A-Z\s&]+?)(?:\s|$)/i  // "from MERCHANT"
    ];
    
    for (const pattern of patterns) {
      const match = transaction.description.match(pattern);
      if (match && match[1]) {
        merchant = match[1].trim();
        break;
      }
    }
    
    if (!merchants[merchant]) {
      merchants[merchant] = {
        name: merchant,
        totalSpent: 0,
        totalReceived: 0,
        transactionCount: 0,
        avgAmount: 0,
        categories: {},
        lastTransaction: null
      };
    }
    
    const amount = Math.abs(transaction.convertedAmount || 0);
    
    if (transaction.type === 'Expense') {
      merchants[merchant].totalSpent += amount;
    } else if (transaction.type === 'Income') {
      merchants[merchant].totalReceived += amount;
    }
    
    merchants[merchant].transactionCount++;
    
    const category = transaction.category || 'Uncategorized';
    if (!merchants[merchant].categories[category]) {
      merchants[merchant].categories[category] = 0;
    }
    merchants[merchant].categories[category] += amount;
    
    if (!merchants[merchant].lastTransaction || 
        new Date(transaction.dateIso) > new Date(merchants[merchant].lastTransaction)) {
      merchants[merchant].lastTransaction = transaction.dateIso;
    }
  });
  
  // Calculate averages and sort
  Object.values(merchants).forEach(merchant => {
    merchant.avgAmount = merchant.transactionCount > 0 
      ? (merchant.totalSpent + merchant.totalReceived) / merchant.transactionCount 
      : 0;
  });
  
  return Object.values(merchants)
    .sort((a, b) => (b.totalSpent + b.totalReceived) - (a.totalSpent + a.totalReceived))
    .slice(0, 50); // Top 50 merchants
}

// Cash flow calendar (daily breakdown)
function calculateCashFlowCalendar(transactions, startDate = null, endDate = null) {
  const calendar = {};
  
  // Determine date range
  let start = startDate ? new Date(startDate) : null;
  let end = endDate ? new Date(endDate) : null;
  
  if (!start || !end) {
    transactions.forEach(t => {
      if (t.dateIso) {
        const date = new Date(t.dateIso);
        if (!start || date < start) start = new Date(date);
        if (!end || date > end) end = new Date(date);
      }
    });
  }
  
  if (!start || !end) return calendar;
  
  // Initialize all dates in range
  const current = new Date(start);
  while (current <= end) {
    const dateKey = current.toISOString().split('T')[0];
    calendar[dateKey] = {
      date: dateKey,
      income: 0,
      expense: 0,
      net: 0,
      transactionCount: 0,
      transactions: []
    };
    current.setDate(current.getDate() + 1);
  }
  
  // Fill in transaction data
  transactions.forEach(transaction => {
    if (!transaction.dateIso || transaction.type === 'Transfer') return;
    
    const dateKey = transaction.dateIso.split('T')[0];
    if (calendar[dateKey]) {
      const amount = transaction.convertedAmount || 0;
      
      if (transaction.type === 'Income') {
        calendar[dateKey].income += amount;
      } else if (transaction.type === 'Expense') {
        calendar[dateKey].expense += amount;
      }
      
      calendar[dateKey].net = calendar[dateKey].income - calendar[dateKey].expense;
      calendar[dateKey].transactionCount++;
      calendar[dateKey].transactions.push({
        id: transaction.id,
        description: transaction.description,
        amount: amount,
        type: transaction.type,
        category: transaction.category
      });
    }
  });
  
  return Object.values(calendar).sort((a, b) => a.date.localeCompare(b.date));
}

// Financial health score (0-100)
function calculateFinancialHealthScore(analytics, predictions) {
  let score = 50; // Base score
  
  // Savings rate (0-25 points)
  const savingsRate = analytics.totalIncome > 0 
    ? (analytics.netBalance / analytics.totalIncome) 
    : 0;
  if (savingsRate >= 0.2) score += 25;
  else if (savingsRate >= 0.1) score += 15;
  else if (savingsRate >= 0.05) score += 10;
  else if (savingsRate >= 0) score += 5;
  else score -= 10; // Negative savings
  
  // Expense stability (0-15 points)
  const monthlyTrends = analytics.monthlyTrends || [];
  if (monthlyTrends.length >= 3) {
    const expenses = monthlyTrends.map(m => m.expense);
    const avgExpense = expenses.reduce((a, b) => a + b, 0) / expenses.length;
    const variance = expenses.reduce((sum, e) => sum + Math.pow(e - avgExpense, 2), 0) / expenses.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = avgExpense > 0 ? stdDev / avgExpense : 0;
    
    if (coefficientOfVariation < 0.1) score += 15; // Very stable
    else if (coefficientOfVariation < 0.2) score += 10;
    else if (coefficientOfVariation < 0.3) score += 5;
  }
  
  // Emergency fund (0-20 points)
  const monthlyExpense = analytics.totalExpense / Math.max(1, monthlyTrends.length || 1);
  const monthsOfExpenses = monthlyExpense > 0 ? analytics.netBalance / monthlyExpense : 0;
  if (monthsOfExpenses >= 6) score += 20;
  else if (monthsOfExpenses >= 3) score += 15;
  else if (monthsOfExpenses >= 1) score += 10;
  else if (monthsOfExpenses >= 0) score += 5;
  
  // Spending velocity (0-15 points)
  const dailyExpense = analytics.dailyAverages?.expense || 0;
  const monthlyProjection = dailyExpense * 30;
  const actualMonthly = monthlyExpense;
  const velocityRatio = actualMonthly > 0 ? monthlyProjection / actualMonthly : 1;
  
  if (velocityRatio < 1.1) score += 15; // Spending is consistent
  else if (velocityRatio < 1.2) score += 10;
  else if (velocityRatio < 1.3) score += 5;
  else score -= 5; // Spending accelerating
  
  // Debt/negative balance (0-10 points)
  if (analytics.netBalance < 0) {
    score -= 20; // Significant penalty for negative balance
  }
  
  // Future outlook (0-15 points)
  if (predictions && predictions.nextMonth) {
    const futureNet = predictions.nextMonth.net || 0;
    if (futureNet > 0) score += 15;
    else if (futureNet > -monthlyExpense * 0.1) score += 10;
    else if (futureNet > -monthlyExpense * 0.2) score += 5;
    else score -= 10;
  }
  
  // Cap score between 0 and 100
  score = Math.max(0, Math.min(100, score));
  
  // Determine grade
  let grade = 'F';
  if (score >= 90) grade = 'A+';
  else if (score >= 80) grade = 'A';
  else if (score >= 75) grade = 'B+';
  else if (score >= 70) grade = 'B';
  else if (score >= 65) grade = 'C+';
  else if (score >= 60) grade = 'C';
  else if (score >= 50) grade = 'D';
  
  return {
    score: Math.round(score),
    grade,
    breakdown: {
      savingsRate: Math.round(savingsRate * 100),
      monthsOfExpenses: Math.round(monthsOfExpenses * 10) / 10,
      expenseStability: monthlyTrends.length >= 3 ? 'good' : 'insufficient_data',
      spendingVelocity: velocityRatio < 1.1 ? 'stable' : 'accelerating',
      futureOutlook: predictions?.nextMonth?.net > 0 ? 'positive' : 'negative'
    }
  };
}

// Spending velocity indicators
function calculateSpendingVelocity(analytics) {
  const velocity = {
    daily: analytics.dailyAverages?.expense || 0,
    weekly: (analytics.dailyAverages?.expense || 0) * 7,
    monthly: (analytics.dailyAverages?.expense || 0) * 30,
    trend: 'stable', // 'accelerating', 'decelerating', 'stable'
    acceleration: 0, // Rate of change
    burnRate: null, // Days until balance reaches zero
    velocityScore: 0 // 0-100 score
  };
  
  const monthlyTrends = analytics.monthlyTrends || [];
  if (monthlyTrends.length >= 3) {
    const recent = monthlyTrends.slice(-3);
    const expenses = recent.map(m => m.expense);
    
    // Calculate trend
    const first = expenses[0];
    const last = expenses[expenses.length - 1];
    const change = ((last - first) / first) * 100;
    
    velocity.acceleration = change;
    
    if (change > 5) velocity.trend = 'accelerating';
    else if (change < -5) velocity.trend = 'decelerating';
    else velocity.trend = 'stable';
  }
  
  // Calculate burn rate
  if (velocity.daily > 0 && analytics.netBalance > 0) {
    velocity.burnRate = Math.ceil(analytics.netBalance / velocity.daily);
  }
  
  // Velocity score (0-100)
  if (velocity.trend === 'stable') velocity.velocityScore = 75;
  else if (velocity.trend === 'decelerating') velocity.velocityScore = 85;
  else velocity.velocityScore = 60;
  
  return velocity;
}

// AI Insights Engine
function generateAIInsights(analytics, predictions, patterns, merchants) {
  const insights = [];
  
  // Spending pattern insights
  if (patterns && patterns.byDayOfWeek) {
    const dayData = Object.entries(patterns.byDayOfWeek)
      .map(([day, data]) => ({ day, expense: data.expense }))
      .sort((a, b) => b.expense - a.expense);
    
    if (dayData.length > 0) {
      const topDay = dayData[0];
      const avgExpense = dayData.reduce((sum, d) => sum + d.expense, 0) / dayData.length;
      
      if (topDay.expense > avgExpense * 1.2) {
        insights.push({
          type: 'spending_pattern',
          title: `You spend ${((topDay.expense / avgExpense - 1) * 100).toFixed(0)}% more on ${topDay.day}s`,
          message: `Your average spending on ${topDay.day} is ${((topDay.expense / avgExpense) * 100).toFixed(0)}% higher than your weekly average. Consider reviewing your ${topDay.day} spending habits.`,
          impact: 'medium',
          category: 'Spending Patterns'
        });
      }
    }
  }
  
  // Time of month insights
  if (patterns && patterns.byTimeOfMonth) {
    const periodData = Object.entries(patterns.byTimeOfMonth)
      .map(([period, data]) => ({ period, expense: data.expense }))
      .sort((a, b) => b.expense - a.expense);
    
    if (periodData.length > 0) {
      const topPeriod = periodData[0];
      const avgExpense = periodData.reduce((sum, p) => sum + p.expense, 0) / periodData.length;
      
      if (topPeriod.expense > avgExpense * 1.15) {
        insights.push({
          type: 'time_pattern',
          title: `Higher spending in days ${topPeriod.period} of the month`,
          message: `You tend to spend more during the ${topPeriod.period === '1-7' ? 'first' : topPeriod.period === '8-14' ? 'second' : topPeriod.period === '15-21' ? 'third' : 'last'} week of the month.`,
          impact: 'low',
          category: 'Spending Patterns'
        });
      }
    }
  }
  
  // Merchant insights
  if (merchants && merchants.length > 0) {
    const topMerchant = merchants[0];
    if (topMerchant.totalSpent > 0) {
      const monthlyAvg = topMerchant.totalSpent / Math.max(1, analytics.monthlyTrends?.length || 1);
      insights.push({
        type: 'merchant',
        title: `Top merchant: ${topMerchant.name}`,
        message: `You've spent an average of ${monthlyAvg.toFixed(0)} ILS/month at ${topMerchant.name} across ${topMerchant.transactionCount} transactions.`,
        impact: 'low',
        category: 'Merchant Analysis',
        data: {
          merchant: topMerchant.name,
          totalSpent: topMerchant.totalSpent,
          transactionCount: topMerchant.transactionCount
        }
      });
    }
  }
  
  // Anomaly detection
  const monthlyTrends = analytics.monthlyTrends || [];
  if (monthlyTrends.length >= 3) {
    const expenses = monthlyTrends.map(m => m.expense);
    const avgExpense = expenses.reduce((a, b) => a + b, 0) / expenses.length;
    const stdDev = calculateStdDev(expenses);
    
    const lastExpense = expenses[expenses.length - 1];
    const zScore = stdDev > 0 ? (lastExpense - avgExpense) / stdDev : 0;
    
    if (Math.abs(zScore) > 2) {
      insights.push({
        type: 'anomaly',
        title: zScore > 0 ? 'Unusually high spending detected' : 'Unusually low spending detected',
        message: zScore > 0 
          ? `Your last month's spending was ${((zScore - 2) * 100).toFixed(0)}% higher than your average. Review your transactions to identify the cause.`
          : `Your last month's spending was significantly lower than average. Great job!`,
        impact: zScore > 0 ? 'high' : 'low',
        category: 'Anomaly Detection',
        severity: Math.abs(zScore) > 3 ? 'high' : 'medium'
      });
    }
  }
  
  // Personalized recommendations
  const savingsRate = analytics.totalIncome > 0 
    ? (analytics.netBalance / analytics.totalIncome) 
    : 0;
  
  if (savingsRate < 0.1) {
    insights.push({
      type: 'recommendation',
      title: 'Increase your savings rate',
      message: `Your current savings rate is ${(savingsRate * 100).toFixed(1)}%. Aim for at least 20% to build a strong financial foundation.`,
      impact: 'high',
      category: 'Recommendations',
      action: 'Review your top expense categories and identify areas to reduce spending.'
    });
  }
  
  // Category spending recommendations
  const topCategories = analytics.topExpenseCategories || [];
  if (topCategories.length > 0) {
    const topCategory = topCategories[0];
    const categoryName = Array.isArray(topCategory) ? topCategory[0] : topCategory.category;
    const categoryAmount = Array.isArray(topCategory) ? topCategory[1] : topCategory.amount;
    const categoryPercentage = (categoryAmount / analytics.totalExpense) * 100;
    
    if (categoryPercentage > 30) {
      insights.push({
        type: 'recommendation',
        title: `Focus on ${categoryName} spending`,
        message: `${categoryName} accounts for ${categoryPercentage.toFixed(1)}% of your expenses. Consider reviewing this category for optimization opportunities.`,
        impact: 'high',
        category: 'Recommendations',
        action: `Review your ${categoryName} transactions and identify ways to reduce spending.`
      });
    }
  }
  
  return insights.sort((a, b) => {
    const impactOrder = { 'high': 3, 'medium': 2, 'low': 1 };
    return impactOrder[b.impact] - impactOrder[a.impact];
  });
}

// Calculate loans and debts (money lent to others)
function calculateLoansAndDebts(transactions) {
  const loans = {};
  
  transactions.forEach(transaction => {
    if (!transaction.personCompany || transaction.type === 'Transfer') return;
    
    const person = transaction.personCompany.trim();
    if (!loans[person]) {
      loans[person] = {
        person: person,
        totalLent: 0,      // Money you gave (Expense)
        totalRepaid: 0,   // Money returned (Income)
        outstanding: 0,    // Still owed to you
        transactions: [],
        lastTransaction: null
      };
    }
    
    const amount = transaction.convertedAmount || 0;
    
    if (transaction.type === 'Expense') {
      // You lent money (outgoing)
      loans[person].totalLent += amount;
      loans[person].outstanding += amount;
    } else if (transaction.type === 'Income') {
      // Money returned (incoming)
      loans[person].totalRepaid += amount;
      loans[person].outstanding -= amount;
    }
    
    loans[person].transactions.push({
      id: transaction.id,
      date: transaction.dateIso,
      type: transaction.type,
      amount: amount,
      description: transaction.description,
      currency: transaction.currency
    });
    
    // Track last transaction date
    if (!loans[person].lastTransaction || 
        new Date(transaction.dateIso) > new Date(loans[person].lastTransaction)) {
      loans[person].lastTransaction = transaction.dateIso;
    }
  });
  
  // Convert to array and calculate summary
  const loansArray = Object.values(loans)
    .map(loan => ({
      ...loan,
      outstanding: Math.max(0, loan.outstanding), // Can't be negative (if repaid more than lent, it's 0)
      isRepaid: loan.outstanding <= 0,
      repaymentRate: loan.totalLent > 0 ? (loan.totalRepaid / loan.totalLent) * 100 : 0
    }))
    .sort((a, b) => b.outstanding - a.outstanding); // Sort by outstanding amount
  
  // Calculate summary
  const summary = {
    totalLent: loansArray.reduce((sum, loan) => sum + loan.totalLent, 0),
    totalRepaid: loansArray.reduce((sum, loan) => sum + loan.totalRepaid, 0),
    totalOutstanding: loansArray.reduce((sum, loan) => sum + loan.outstanding, 0),
    activeLoans: loansArray.filter(loan => loan.outstanding > 0).length,
    repaidLoans: loansArray.filter(loan => loan.outstanding <= 0).length,
    totalPeople: loansArray.length
  };
  
  return {
    loans: loansArray,
    summary
  };
}

// Calculate expenses by person/company (for spending analysis)
function calculateExpensesByPerson(transactions) {
  const personExpenses = {};
  
  transactions.forEach(transaction => {
    // Only track expenses with person/company (not transfers)
    if (!transaction.personCompany || transaction.type !== 'Expense') return;
    
    const person = transaction.personCompany.trim();
    if (!personExpenses[person]) {
      personExpenses[person] = {
        person: person,
        totalExpense: 0,
        transactionCount: 0,
        categories: {},
        transactions: [],
        lastTransaction: null
      };
    }
    
    const amount = transaction.convertedAmount || 0;
    personExpenses[person].totalExpense += amount;
    personExpenses[person].transactionCount++;
    
    // Track by category
    const category = transaction.category || 'Uncategorized';
    if (!personExpenses[person].categories[category]) {
      personExpenses[person].categories[category] = 0;
    }
    personExpenses[person].categories[category] += amount;
    
    personExpenses[person].transactions.push({
      id: transaction.id,
      date: transaction.dateIso,
      amount: amount,
      category: category,
      description: transaction.description,
      currency: transaction.currency
    });
    
    // Track last transaction
    if (!personExpenses[person].lastTransaction || 
        new Date(transaction.dateIso) > new Date(personExpenses[person].lastTransaction)) {
      personExpenses[person].lastTransaction = transaction.dateIso;
    }
  });
  
  return Object.values(personExpenses)
    .sort((a, b) => b.totalExpense - a.totalExpense);
}

// Calculate debt transactions (Income and Expense with Debt category) by person
function calculateDebtByPerson(transactions) {
  const debtByPerson = {};
  
  transactions.forEach(transaction => {
    // Only track transactions with Debt category and person/company
    if (!transaction.personCompany || !transaction.category) return;
    
    const categoryName = transaction.category.toLowerCase();
    if (!categoryName.includes('debt')) return;
    
    const person = transaction.personCompany.trim();
    if (!debtByPerson[person]) {
      debtByPerson[person] = {
        person: person,
        incomeDebt: 0,      // Money returned (Income with Debt category)
        expenseDebt: 0,     // Money lent (Expense with Debt category)
        netDebt: 0,          // expenseDebt - incomeDebt (what they owe)
        transactionCount: 0,
        transactions: [],
        lastTransaction: null
      };
    }
    
    const amount = transaction.convertedAmount || 0;
    
    if (transaction.type === 'Income') {
      debtByPerson[person].incomeDebt += amount;
      debtByPerson[person].netDebt -= amount; // Reduces what they owe
    } else if (transaction.type === 'Expense') {
      debtByPerson[person].expenseDebt += amount;
      debtByPerson[person].netDebt += amount; // Increases what they owe
    }
    
    debtByPerson[person].transactionCount++;
    
    debtByPerson[person].transactions.push({
      id: transaction.id,
      date: transaction.dateIso,
      type: transaction.type,
      amount: amount,
      description: transaction.description,
      currency: transaction.currency
    });
    
    // Track last transaction
    if (!debtByPerson[person].lastTransaction || 
        new Date(transaction.dateIso) > new Date(debtByPerson[person].lastTransaction)) {
      debtByPerson[person].lastTransaction = transaction.dateIso;
    }
  });
  
  // Convert to array and calculate net debt
  return Object.values(debtByPerson)
    .map(debt => ({
      ...debt,
      netDebt: Math.max(0, debt.netDebt), // Can't be negative
      isRepaid: debt.netDebt <= 0
    }))
    .sort((a, b) => b.netDebt - a.netDebt);
}

module.exports = {
  parseCSV,
  calculateAnalytics,
  generatePredictions,
  generateSavingsTips,
  filterByDateRange,
  calculateSpendingTrends,
  calculateCategoryTrends,
  calculateYearOverYear,
  detectRecurringTransactions,
  filterTransactions,
  calculateSpendingPatterns,
  analyzeMerchants,
  calculateCashFlowCalendar,
  calculateFinancialHealthScore,
  calculateSpendingVelocity,
  generateAIInsights
};


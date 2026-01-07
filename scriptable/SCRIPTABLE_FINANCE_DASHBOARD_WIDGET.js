// Finance App - Dashboard Widget (Large Widget)
// Supports two widget types via parameter:
//   - "budget": Shows budget status only
//   - "dashboard": Shows net worth, income, expense, and last transaction
// 
// To use: In Scriptable widget settings, add parameter:
//   - "budget" for budget widget
//   - "dashboard" for dashboard widget
//   - (no parameter or empty = budget mode for backward compatibility)

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  // API base URL for your deployed server (must be updated before use)
  SERVER_URL: 'https://your-api-host.com',
  // Optional defaults - prefer passing credentials from a Shortcut
  USERNAME: 'YOUR_USERNAME',
  PASSWORD: 'YOUR_PASSWORD',
  TOKEN_KEY: 'finance_app_token',
  USER_KEY: 'finance_app_user',
  DEBUG: false,
  // Widget settings
  MAX_BUDGETS: 8, // Number of budget rules to show (budget mode)
  SHOW_ACCOUNTS: true, // Show account balances (dashboard mode)
  SHOW_SUMMARY: true // Show monthly summary (dashboard mode)
};

// Get widget type from parameter (default to 'budget' for backward compatibility)
// In Scriptable widget settings, add parameter: "budget" or "dashboard"
let WIDGET_TYPE = 'budget'; // Default
try {
  if (typeof args !== 'undefined' && args.widgetParameter) {
    WIDGET_TYPE = args.widgetParameter.toLowerCase().trim() || 'budget';
  } else if (typeof config !== 'undefined' && config.widgetParameter) {
    WIDGET_TYPE = config.widgetParameter.toLowerCase().trim() || 'budget';
  }
} catch (e) {
  // If parameter access fails, use default
  WIDGET_TYPE = 'budget';
}

// Helper function for debug logging
function debugLog(...args) {
  if (CONFIG.DEBUG) {
    let message = '';
    for (const arg of args) {
      if (typeof arg === 'object' && arg !== null) {
        message += JSON.stringify(arg) + ' ';
      } else {
        message += arg + ' ';
      }
    }
    console.log('[DEBUG]', message.trim());
  }
}

// ============================================
// AUTHENTICATION
// ============================================

function getStoredToken() {
  try {
    return Keychain.get(CONFIG.TOKEN_KEY) || null;
  } catch (error) {
    return null;
  }
}

function storeToken(token) {
  try {
    Keychain.set(CONFIG.TOKEN_KEY, token);
    return true;
  } catch (error) {
    return false;
  }
}

async function login(username = null, password = null) {
  const user = username || CONFIG.USERNAME;
  const pass = password || CONFIG.PASSWORD;
  
  try {
    if (!CONFIG.SERVER_URL || CONFIG.SERVER_URL.includes('your-api-host.com')) {
      throw new Error('CONFIG.SERVER_URL must point to your deployed API (e.g. https://api.example.com)');
    }
    if (!user || !pass || user === 'YOUR_USERNAME' || pass === 'YOUR_PASSWORD') {
      throw new Error('Provide username/password via Shortcut input or CONFIG before running the widget');
    }
    
    const url = `${CONFIG.SERVER_URL}/api/auth/login?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`;
    const request = new Request(url);
    request.method = 'GET';
    request.headers = {
      'Accept': 'application/json',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
    request.timeoutInterval = 10;
    
    const response = await request.loadJSON();
    
    if (response.token) {
      storeToken(response.token);
      if (response.user) {
        Keychain.set(CONFIG.USER_KEY, JSON.stringify(response.user));
      }
      return { success: true, token: response.token };
    } else {
      return { success: false, error: response.error || 'Login failed' };
    }
  } catch (error) {
    return { success: false, error: error.message || 'Network error' };
  }
}

async function validateToken(token) {
  try {
    const url = `${CONFIG.SERVER_URL}/api/auth/me`;
    const request = new Request(url);
    request.headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    };
    request.timeoutInterval = 10;
    
    const response = await request.loadJSON();
    return response.user ? true : false;
  } catch (error) {
    return false;
  }
}

async function getValidToken() {
  let token = getStoredToken();
  
  if (token) {
    const isValid = await validateToken(token);
    if (isValid) {
      return { success: true, token };
    }
  }
  
  const loginResult = await login();
  if (loginResult.success) {
    return { success: true, token: loginResult.token };
  }
  
  return { success: false, error: loginResult.error };
}

// ============================================
// API FUNCTIONS
// ============================================

async function getBudgetStatus(token) {
  try {
    const url = `${CONFIG.SERVER_URL}/api/settings/budget-status`;
    const request = new Request(url);
    request.headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    };
    request.timeoutInterval = 10;
    
    const response = await request.loadJSON();
    return {
      success: true,
      budgets: response.budgets || []
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to fetch budget status'
    };
  }
}

async function getAccounts(token) {
  try {
    const url = `${CONFIG.SERVER_URL}/api/accounts`;
    const request = new Request(url);
    request.headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    };
    request.timeoutInterval = 10;
    
    const response = await request.loadJSON();
    return {
      success: true,
      accounts: response.accounts || []
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to fetch accounts'
    };
  }
}

async function getMonthlySummary(token) {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    const startDate = startOfMonth.toISOString().split('T')[0];
    const endDate = endOfMonth.toISOString().split('T')[0];
    
    // Get all transactions for the month
    const url = `${CONFIG.SERVER_URL}/api/transactions?startDate=${startDate}&endDate=${endDate}&limit=1000`;
    const request = new Request(url);
    request.headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    };
    request.timeoutInterval = 10;
    
    const response = await request.loadJSON();
    const transactions = response.transactions || [];
    
    let totalIncome = 0;
    let totalExpense = 0;
    
    // Use convertedAmount (in ILS) instead of amount (in transaction currency)
    transactions.forEach(tx => {
      // Use convertedAmount which is already in ILS (account's base currency)
      const amount = parseFloat(tx.convertedAmount || tx.converted_amount || tx.amount || 0);
      if (tx.type === 'Income') {
        totalIncome += amount;
      } else if (tx.type === 'Expense') {
        totalExpense += amount;
      }
    });
    
    return {
      success: true,
      income: totalIncome, // In ILS
      expense: totalExpense, // In ILS
      net: totalIncome - totalExpense // In ILS
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to calculate summary'
    };
  }
}

async function getNetWorth(token) {
  try {
    const url = `${CONFIG.SERVER_URL}/api/accounts?convertToILS=true`;
    const request = new Request(url);
    request.headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    };
    request.timeoutInterval = 10;
    
    const response = await request.loadJSON();
    const accounts = response.accounts || [];
    
    // Calculate total net worth in ILS
    const totalNetWorth = accounts.reduce((sum, acc) => {
      const balanceILS = parseFloat(acc.balanceILS || acc.balance || 0);
      return sum + balanceILS;
    }, 0);
    
    return {
      success: true,
      totalNetWorth, // In ILS
      accounts: accounts.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to fetch net worth'
    };
  }
}

async function getLastTransaction(token) {
  try {
    // Get last transaction (most recent - API already orders by dateIso desc)
    const url = `${CONFIG.SERVER_URL}/api/transactions?limit=1`;
    const request = new Request(url);
    request.headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    };
    request.timeoutInterval = 10;
    
    const response = await request.loadJSON();
    const transactions = response.transactions || [];
    
    if (transactions.length === 0) {
      return {
        success: true,
        transaction: null
      };
    }
    
    const tx = transactions[0];
    const amount = parseFloat(tx.convertedAmount || tx.converted_amount || tx.amount || 0);
    
    return {
      success: true,
      transaction: {
        id: tx.id,
        type: tx.type,
        amount: amount,
        currency: tx.currency || 'ILS',
        category: tx.categoryName || tx.category_name || tx.category || 'Uncategorized',
        account: tx.accountName || tx.account_name || tx.account || 'Unknown',
        description: tx.description || tx.personCompany || tx.person_company || '',
        date: tx.dateIso || tx.date_iso || tx.date
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to fetch last transaction'
    };
  }
}

// ============================================
// WIDGET UI
// ============================================

function formatCurrency(amount, currency = 'ILS') {
  const num = parseFloat(amount) || 0;
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(2)} ${currency}`;
}

function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      const formatter = new DateFormatter();
      formatter.useShortDateStyle();
      return formatter.string(date);
    }
  } catch (error) {
    return dateString;
  }
}

function getBudgetStatusIcon(status) {
  if (status === 'exceeded') return '🔴';
  if (status === 'warning') return '🟡';
  return '🟢';
}

function getBudgetStatusColor(status) {
  if (status === 'exceeded') return new Color('#FF3B30'); // Red
  if (status === 'warning') return new Color('#FF9500'); // Orange
  return new Color('#34C759'); // Green
}

function createBudgetWidget(data) {
  const widget = new ListWidget();
  widget.backgroundColor = new Color('#1C1C1E'); // Dark background
  widget.setPadding(15, 15, 15, 15);
  
  // Header
  const headerStack = widget.addStack();
  headerStack.layoutHorizontally();
  const title = headerStack.addText('💰 Budget Status');
  title.font = Font.boldSystemFont(18);
  title.textColor = Color.white();
  headerStack.addSpacer();
  
  // Budget Status
  widget.addSpacer(10);
  
  if (data.budgets && data.budgets.success && data.budgets.budgets.length > 0) {
    const budgets = data.budgets.budgets.slice(0, CONFIG.MAX_BUDGETS);
    
    budgets.forEach((budget, index) => {
      widget.addSpacer(8);
      
      // Budget card
      const budgetCard = widget.addStack();
      budgetCard.layoutVertically();
      budgetCard.setPadding(10, 10, 10, 10);
      budgetCard.backgroundColor = new Color('#2C2C2E');
      budgetCard.cornerRadius = 8;
      budgetCard.spacing = 6;
      
      // Header row: Name and Status icon
      const headerRow = budgetCard.addStack();
      headerRow.layoutHorizontally();
      const budgetName = headerRow.addText(budget.name || 'Budget');
      budgetName.font = Font.boldSystemFont(13);
      budgetName.textColor = Color.white();
      headerRow.addSpacer();
      const statusIcon = headerRow.addText(getBudgetStatusIcon(budget.status));
      statusIcon.font = Font.systemFont(16);
      
      // Progress info
      const progressRow = budgetCard.addStack();
      progressRow.layoutHorizontally();
      const spentLabel = progressRow.addText('Spent:');
      spentLabel.font = Font.systemFont(11);
      spentLabel.textColor = Color.lightGray();
      progressRow.addSpacer();
      const spentAmount = progressRow.addText(formatCurrency(budget.currentSpending, budget.currency));
      spentAmount.font = Font.boldSystemFont(12);
      spentAmount.textColor = getBudgetStatusColor(budget.status);
      
      // Remaining/Over info
      const remainingRow = budgetCard.addStack();
      remainingRow.layoutHorizontally();
      if (budget.exceeded) {
        const overLabel = remainingRow.addText('Over by:');
        overLabel.font = Font.systemFont(11);
        overLabel.textColor = Color.lightGray();
        remainingRow.addSpacer();
        const overAmount = remainingRow.addText(formatCurrency(budget.overBy, budget.currency));
        overAmount.font = Font.boldSystemFont(12);
        overAmount.textColor = new Color('#FF3B30');
      } else {
        const remainingLabel = remainingRow.addText('Remaining:');
        remainingLabel.font = Font.systemFont(11);
        remainingLabel.textColor = Color.lightGray();
        remainingRow.addSpacer();
        const remainingAmount = remainingRow.addText(formatCurrency(budget.remaining, budget.currency));
        remainingAmount.font = Font.boldSystemFont(12);
        remainingAmount.textColor = new Color('#34C759');
      }
      
      // Percentage and threshold
      const infoRow = budgetCard.addStack();
      infoRow.layoutHorizontally();
      const percentageText = infoRow.addText(`${budget.percentage.toFixed(1)}%`);
      percentageText.font = Font.systemFont(11);
      percentageText.textColor = Color.lightGray();
      infoRow.addSpacer();
      const thresholdText = infoRow.addText(`of ${formatCurrency(budget.threshold, budget.currency)}`);
      thresholdText.font = Font.systemFont(11);
      thresholdText.textColor = Color.lightGray();
      
      // Category/Account info (if available)
      if (budget.categoryNames && budget.categoryNames.length > 0) {
        budgetCard.addSpacer(4);
        const categoryText = budgetCard.addText(`📂 ${budget.categoryNames.join(', ')}`);
        categoryText.font = Font.systemFont(10);
        categoryText.textColor = Color.lightGray();
      }
      if (budget.accountName) {
        budgetCard.addSpacer(2);
        const accountText = budgetCard.addText(`🏦 ${budget.accountName}`);
        accountText.font = Font.systemFont(10);
        accountText.textColor = Color.lightGray();
      }
    });
  } else {
    widget.addSpacer(8);
    const noBudgetText = widget.addText('No budget rules configured');
    noBudgetText.font = Font.systemFont(12);
    noBudgetText.textColor = Color.lightGray();
  }
  
  widget.addSpacer();
  
  // Footer
  const footer = widget.addText('Last updated: ' + new Date().toLocaleTimeString());
  footer.font = Font.footnote();
  footer.textColor = Color.lightGray();
  footer.rightAlignText();
  
  return widget;
}

function createDashboardWidget(data) {
  const widget = new ListWidget();
  widget.backgroundColor = new Color('#1C1C1E'); // Dark background
  widget.setPadding(15, 15, 15, 15);
  
  // Header
  const headerStack = widget.addStack();
  headerStack.layoutHorizontally();
  const title = headerStack.addText('💰 Finance Dashboard');
  title.font = Font.boldSystemFont(18);
  title.textColor = Color.white();
  headerStack.addSpacer();
  
  // Net Worth Section
  if (data.netWorth && data.netWorth.success) {
    widget.addSpacer(10);
    const netWorthCard = widget.addStack();
    netWorthCard.layoutVertically();
    netWorthCard.setPadding(12, 12, 12, 12);
    netWorthCard.backgroundColor = new Color('#2C2C2E');
    netWorthCard.cornerRadius = 10;
    
    const netWorthLabel = netWorthCard.addText('Net Worth');
    netWorthLabel.font = Font.systemFont(11);
    netWorthLabel.textColor = Color.lightGray();
    netWorthCard.addSpacer(4);
    const netWorthValue = netWorthCard.addText(formatCurrency(data.netWorth.totalNetWorth, 'ILS'));
    netWorthValue.font = Font.boldSystemFont(24);
    netWorthValue.textColor = Color.white();
  }
  
  // Monthly Summary Section
  if (data.summary && data.summary.success) {
    widget.addSpacer(10);
    const summaryStack = widget.addStack();
    summaryStack.layoutHorizontally();
    summaryStack.spacing = 10;
    
    // Income
    const incomeBox = summaryStack.addStack();
    incomeBox.layoutVertically();
    incomeBox.setPadding(10, 10, 10, 10);
    incomeBox.backgroundColor = new Color('#2C2C2E');
    incomeBox.cornerRadius = 8;
    const incomeLabel = incomeBox.addText('Income');
    incomeLabel.font = Font.systemFont(10);
    incomeLabel.textColor = Color.lightGray();
    incomeBox.addSpacer(4);
    const incomeValue = incomeBox.addText(formatCurrency(data.summary.income));
    incomeValue.font = Font.boldSystemFont(16);
    incomeValue.textColor = new Color('#34C759');
    
    summaryStack.addSpacer();
    
    // Expense
    const expenseBox = summaryStack.addStack();
    expenseBox.layoutVertically();
    expenseBox.setPadding(10, 10, 10, 10);
    expenseBox.backgroundColor = new Color('#2C2C2E');
    expenseBox.cornerRadius = 8;
    const expenseLabel = expenseBox.addText('Expense');
    expenseLabel.font = Font.systemFont(10);
    expenseLabel.textColor = Color.lightGray();
    expenseBox.addSpacer(4);
    const expenseValue = expenseBox.addText(formatCurrency(data.summary.expense));
    expenseValue.font = Font.boldSystemFont(16);
    expenseValue.textColor = new Color('#FF3B30');
    
    summaryStack.addSpacer();
    
    // Net
    const netBox = summaryStack.addStack();
    netBox.layoutVertically();
    netBox.setPadding(10, 10, 10, 10);
    netBox.backgroundColor = new Color('#2C2C2E');
    netBox.cornerRadius = 8;
    const netLabel = netBox.addText('Net');
    netLabel.font = Font.systemFont(10);
    netLabel.textColor = Color.lightGray();
    netBox.addSpacer(4);
    const netValue = netBox.addText(formatCurrency(data.summary.net));
    netValue.font = Font.boldSystemFont(16);
    netValue.textColor = data.summary.net >= 0 ? new Color('#34C759') : new Color('#FF3B30');
  }
  
  // Last Transaction Section
  if (data.lastTransaction && data.lastTransaction.success && data.lastTransaction.transaction) {
    widget.addSpacer(10);
    const lastTxLabel = widget.addText('Last Transaction');
    lastTxLabel.font = Font.boldSystemFont(12);
    lastTxLabel.textColor = Color.lightGray();
    
    widget.addSpacer(6);
    const txCard = widget.addStack();
    txCard.layoutVertically();
    txCard.setPadding(10, 10, 10, 10);
    txCard.backgroundColor = new Color('#2C2C2E');
    txCard.cornerRadius = 8;
    txCard.spacing = 6;
    
    const tx = data.lastTransaction.transaction;
    const txTypeIcon = tx.type === 'Income' ? '📈' : tx.type === 'Expense' ? '📉' : '🔄';
    const txTypeColor = tx.type === 'Income' ? new Color('#34C759') : tx.type === 'Expense' ? new Color('#FF3B30') : Color.lightGray();
    
    // Transaction header
    const txHeader = txCard.addStack();
    txHeader.layoutHorizontally();
    const txType = txHeader.addText(`${txTypeIcon} ${tx.type}`);
    txType.font = Font.boldSystemFont(12);
    txType.textColor = txTypeColor;
    txHeader.addSpacer();
    const txAmount = txHeader.addText(formatCurrency(Math.abs(tx.amount), tx.currency));
    txAmount.font = Font.boldSystemFont(14);
    txAmount.textColor = Color.white();
    
    // Category and account
    const txInfo = txCard.addStack();
    txInfo.layoutHorizontally();
    const txCategory = txInfo.addText(`📂 ${tx.category}`);
    txCategory.font = Font.systemFont(11);
    txCategory.textColor = Color.lightGray();
    txInfo.addSpacer();
    const txAccount = txInfo.addText(`🏦 ${tx.account}`);
    txAccount.font = Font.systemFont(11);
    txAccount.textColor = Color.lightGray();
    
    // Description (if available)
    if (tx.description) {
      txCard.addSpacer(2);
      const txDesc = txCard.addText(tx.description);
      txDesc.font = Font.systemFont(10);
      txDesc.textColor = Color.lightGray();
    }
    
    // Date
    txCard.addSpacer(2);
    const txDate = txCard.addText(formatDate(tx.date));
    txDate.font = Font.systemFont(10);
    txDate.textColor = Color.lightGray();
  }
  
  widget.addSpacer();
  
  // Footer
  const footer = widget.addText('Last updated: ' + new Date().toLocaleTimeString());
  footer.font = Font.footnote();
  footer.textColor = Color.lightGray();
  footer.rightAlignText();
  
  return widget;
}

// ============================================
// MAIN
// ============================================

async function main() {
  try {
    // Get token
    const tokenResult = await getValidToken();
    if (!tokenResult.success) {
      const errorWidget = new ListWidget();
      errorWidget.backgroundColor = new Color('#1C1C1E');
      errorWidget.setPadding(15, 15, 15, 15);
      const errorText = errorWidget.addText('❌ Authentication Failed\n\n' + (tokenResult.error || 'Unknown error'));
      errorText.font = Font.systemFont(12);
      errorText.textColor = Color.red();
      return errorWidget;
    }
    
    const token = tokenResult.token;
    
    // Fetch data based on widget type
    if (WIDGET_TYPE === 'budget') {
      // Budget widget: only fetch budget status
      const budgetsResult = await getBudgetStatus(token);
      const data = {
        budgets: budgetsResult
      };
      return createBudgetWidget(data);
    } else if (WIDGET_TYPE === 'dashboard') {
      // Dashboard widget: fetch net worth, summary, and last transaction
      const [netWorthResult, summaryResult, lastTxResult] = await Promise.all([
        getNetWorth(token),
        getMonthlySummary(token),
        getLastTransaction(token)
      ]);
      
      const data = {
        netWorth: netWorthResult,
        summary: summaryResult,
        lastTransaction: lastTxResult
      };
      return createDashboardWidget(data);
    } else {
      // Unknown widget type - default to budget
      const budgetsResult = await getBudgetStatus(token);
      const data = {
        budgets: budgetsResult
      };
      return createBudgetWidget(data);
    }
  } catch (error) {
    const errorWidget = new ListWidget();
    errorWidget.backgroundColor = new Color('#1C1C1E');
    errorWidget.setPadding(15, 15, 15, 15);
    const errorText = errorWidget.addText('❌ Error\n\n' + (error.message || 'Unknown error'));
    errorText.font = Font.systemFont(12);
    errorText.textColor = Color.red();
    return errorWidget;
  }
}

// Run
const widget = await main();

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  widget.presentLarge();
}

Script.complete();


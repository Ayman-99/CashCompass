// Finance App - Scriptable Integration
// This script handles login, token management, and transaction creation
// Can be called from iPhone Shortcuts

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  // API base URL for your deployed server (must be updated before use)
  SERVER_URL: 'https://your-api-host.com',
  
  // Optional defaults - prefer passing credentials from a Shortcut
  USERNAME: 'YOUR_USERNAME',
  PASSWORD: 'YOUR_PASSWORD',
  
  // Token storage key
  TOKEN_KEY: 'finance_app_token',
  USER_KEY: 'finance_app_user',
  // Debug flag - set to true to enable detailed console logging
  DEBUG: false,
  // Manual debug mode - when true and run without shortcut, automatically tests all functions
  MANUAL_DEBUG: false
};

// Helper function for debug logging
function debugLog(...args) {
  if (CONFIG.DEBUG) {
    // Build a single message string to ensure it's always visible
    let message = '';
    if (args.length === 0) {
      message = '(no message)';
    } else {
      // Convert all arguments to strings
      const parts = args.map(arg => {
        if (arg === null) return 'null';
        if (arg === undefined) return 'undefined';
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      });
      message = parts.join(' ');
    }
    // Use a single console.log with the full message
    console.log('[DEBUG] ' + message);
  }
}

// ============================================
// TOKEN MANAGEMENT
// ============================================

/**
 * Get stored token from Keychain
 */
function getStoredToken() {
  try {
    debugLog('Retrieving token from Keychain...');
    debugLog('Token key:', CONFIG.TOKEN_KEY);
    const token = Keychain.get(CONFIG.TOKEN_KEY);
    debugLog('Token retrieved:', !!token);
    debugLog('Token length:', token ? token.length : 0);
    return token || null;
  } catch (error) {
    debugLog('ERROR: Failed to retrieve token:', error.message || error);
    return null;
  }
}

/**
 * Store token in Keychain
 */
function storeToken(token) {
  try {
    debugLog('Storing token in Keychain...');
    debugLog('Token key:', CONFIG.TOKEN_KEY);
    debugLog('Token length:', token ? token.length : 0);
    Keychain.set(CONFIG.TOKEN_KEY, token);
    debugLog('Token stored successfully');
    
    // Verify it was stored
    const retrieved = Keychain.get(CONFIG.TOKEN_KEY);
    debugLog('Token verification - retrieved from Keychain:', !!retrieved);
    debugLog('Token matches:', retrieved === token);
    
    return true;
  } catch (error) {
    debugLog('ERROR: Failed to store token:', error.message || error);
    console.error('Failed to store token:', error);
    return false;
  }
}

/**
 * Validate token by calling /api/auth/me
 */
async function validateToken(token) {
  try {
    debugLog('Validating token...');
    const url = `${CONFIG.SERVER_URL}/api/auth/me`;
    const request = new Request(url);
    request.headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    const response = await request.loadJSON();
    const isValid = response.user ? true : false;
    debugLog('Token validation result:', isValid);
    return isValid;
  } catch (error) {
    debugLog('Token validation failed:', error.message || error);
    return false;
  }
}

/**
 * Login and get token
 */
async function login(username = null, password = null) {
  const user = username || CONFIG.USERNAME;
  const pass = password || CONFIG.PASSWORD;
  
  try {
    if (!CONFIG.SERVER_URL || CONFIG.SERVER_URL.includes('your-api-host.com')) {
      throw new Error('CONFIG.SERVER_URL must point to your deployed API (e.g. https://api.example.com)');
    }
    if (!user || !pass || user === 'YOUR_USERNAME' || pass === 'YOUR_PASSWORD') {
      throw new Error('Provide username/password via Shortcut input or CONFIG before running the script');
    }
    
    // Use GET endpoint as workaround for Scriptable POST limitation
    // Credentials passed as query parameters
    const url = `${CONFIG.SERVER_URL}/api/auth/login?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`;
    debugLog('=== LOGIN START (GET) ===');
    debugLog('URL:', url.replace(pass, '***')); // Don't log password
    debugLog('Username:', user);
    
    // Create GET request (Scriptable handles GET correctly)
    const request = new Request(url);
    request.method = 'GET';
    request.headers = {
      'Accept': 'application/json',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
    request.timeoutInterval = 10;
    
    debugLog('Request method:', request.method);
    debugLog('Request headers:', JSON.stringify(request.headers));
    
    // Verify request is configured correctly
    if (request.method !== 'GET') {
      debugLog('ERROR: Request method is not GET:', request.method);
      throw new Error(`Request method is ${request.method}, expected GET`);
    }
    
    debugLog('Request configured correctly, sending...');
    
    // Load response and handle errors
    let response;
    let responseString;
    
    try {
      // Verify method one more time right before sending
      if (request.method !== 'GET') {
        debugLog('CRITICAL: Method changed to', request.method, 'before sending! Fixing...');
        request.method = 'GET';
      }
      debugLog('Final method check before send:', request.method);
      
      debugLog('Attempting to load response...');
      // Try to load as JSON first (most common case)
      try {
        debugLog('Trying loadJSON()...');
        response = await request.loadJSON();
        debugLog('loadJSON() succeeded');
        debugLog('Response:', JSON.stringify(response).substring(0, 200));
      } catch (jsonError) {
        debugLog('loadJSON() failed, trying loadString()...');
        debugLog('JSON error:', jsonError.message || jsonError);
        
        // If loadJSON fails, try loadString and parse manually
        responseString = await request.loadString();
        debugLog('loadString() succeeded');
        debugLog('Response length:', responseString ? responseString.length : 0);
        debugLog('Response preview:', responseString ? responseString.substring(0, 300) : 'empty');
        
        // Check if response is empty
        if (!responseString || responseString.trim() === '') {
          debugLog('ERROR: Empty response');
          throw new Error('Empty response from server. Check if server is accessible.');
        }
        
        // Check if response looks like HTML (common for 404 pages)
        if (responseString.trim().startsWith('<')) {
          debugLog('ERROR: Response is HTML (likely 404 page)');
          throw new Error(`Server returned HTML instead of JSON. This usually means the endpoint doesn't exist or the request method is wrong. Response: ${responseString.substring(0, 200)}`);
        }
        
        // Try to parse as JSON
        try {
          debugLog('Attempting to parse as JSON...');
          response = JSON.parse(responseString);
          debugLog('JSON parse succeeded');
        } catch (parseError) {
          debugLog('ERROR: JSON parse failed');
          debugLog('Parse error:', parseError.message || parseError);
          // If parsing fails, show what we got
          throw new Error(`Failed to parse JSON response. Server returned: ${responseString.substring(0, 200)}. Error: ${parseError.message || parseError}`);
        }
      }
      
      // Check if response has an error field
      if (response && response.error) {
        debugLog('Response contains error field:', response.error);
        throw new Error(response.error);
      }
      
      debugLog('Response processed successfully');
      debugLog('Response keys:', Object.keys(response || {}));
      debugLog('Response has token:', !!(response && response.token));
      debugLog('Response has success:', !!(response && response.success));
      debugLog('Full response object:', JSON.stringify(response));
      
    } catch (error) {
      // Better error messages - preserve the original error message
      const errorMsg = error.message || error.toString() || 'Unknown error';
      debugLog('=== LOGIN ERROR ===');
      debugLog('Error message:', errorMsg);
      if (responseString) {
        debugLog('Full response:', responseString.substring(0, 500));
      }
      console.error('Login request failed:', errorMsg);
      throw new Error(errorMsg);
    }
    
    // Check response structure
    if (!response) {
      debugLog('ERROR: Response is null or undefined');
      return {
        success: false,
        error: 'No response from server'
      };
    }
    
    debugLog('Checking response for token...');
    debugLog('response.token exists:', !!(response.token));
    debugLog('response.success:', response.success);
    
    if (response.token) {
      debugLog('Login successful, token received');
      debugLog('Token length:', response.token ? response.token.length : 0);
      debugLog('Token preview:', response.token ? response.token.substring(0, 20) + '...' : 'null');
      
      const stored = storeToken(response.token);
      debugLog('Token stored successfully:', stored);
      
      if (response.user) {
        Keychain.set(CONFIG.USER_KEY, JSON.stringify(response.user));
        debugLog('User info stored');
      }
      debugLog('=== LOGIN SUCCESS ===');
      return {
        success: true,
        token: response.token,
        user: response.user
      };
    } else {
      const errorMsg = response.error || 'Login failed - no token in response';
      debugLog('Login failed - no token in response');
      debugLog('Response structure:', JSON.stringify(response));
      debugLog('Response keys:', Object.keys(response));
      debugLog('=== LOGIN FAILED ===');
      return {
        success: false,
        error: errorMsg
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
}

/**
 * Get valid token (checks stored token or logs in)
 */
async function getValidToken(username = null, password = null) {
  debugLog('=== GET VALID TOKEN START ===');
  // Try to get stored token
  const storedToken = getStoredToken();
  debugLog('Stored token exists:', !!storedToken);
  
  if (storedToken) {
    debugLog('Validating stored token...');
    // Validate stored token
    const isValid = await validateToken(storedToken);
    if (isValid) {
      debugLog('Using cached token');
      debugLog('=== GET VALID TOKEN SUCCESS (CACHED) ===');
      return {
        success: true,
        token: storedToken,
        fromCache: true
      };
    } else {
      debugLog('Cached token invalid, will login');
    }
  } else {
    debugLog('No cached token, will login');
  }
  
  // Token invalid or doesn't exist, login
  debugLog('Attempting login...');
  const loginResult = await login(username, password);
  if (loginResult.success) {
    debugLog('=== GET VALID TOKEN SUCCESS (NEW LOGIN) ===');
    return {
      success: true,
      token: loginResult.token,
      fromCache: false
    };
  } else {
    debugLog('=== GET VALID TOKEN FAILED ===');
    debugLog('Login error:', loginResult.error);
    return {
      success: false,
      error: loginResult.error
    };
  }
}

// ============================================
// ACCOUNT & CATEGORY HELPERS
// ============================================

/**
 * Get all accounts (returns names only)
 */
async function getAccounts(token) {
  try {
    debugLog('=== GET ACCOUNTS START ===');
    debugLog('Token provided:', !!token);
    debugLog('Token length:', token ? token.length : 0);
    debugLog('Token preview:', token ? token.substring(0, 20) + '...' : 'null');
    
    const url = `${CONFIG.SERVER_URL}/api/accounts?attr=name`;
    debugLog('URL:', url);
    
    const request = new Request(url);
    request.method = 'GET';
    request.timeoutInterval = 10; // 10 seconds timeout
    request.headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    debugLog('Request headers:', JSON.stringify(request.headers));
    debugLog('Request method:', request.method);
    debugLog('Sending request...');
    
    const response = await request.loadJSON();
    debugLog('Response received');
    
    debugLog('Response keys:', Object.keys(response || {}));
    debugLog('Response has error:', !!(response && response.error));
    
    // Check if response has error
    if (response.error) {
      debugLog('ERROR in response:', response.error);
      debugLog('=== GET ACCOUNTS FAILED ===');
      return {
        success: false,
        error: response.error
      };
    }
    
    // When attr=name, API returns object directly, not wrapped in { accounts: ... }
    // When no attr, API returns { accounts: [...] }
    if (response.accounts) {
      debugLog('Accounts found in response.accounts');
      debugLog('=== GET ACCOUNTS SUCCESS ===');
      return {
        success: true,
        accounts: response.accounts
      };
    } else {
      // Response is the accounts object directly (attr=name case)
      debugLog('Accounts found directly in response');
      debugLog('=== GET ACCOUNTS SUCCESS ===');
      return {
        success: true,
        accounts: response || {}
      };
    }
  } catch (error) {
    // Better error handling for network issues
    let errorMsg = 'Network connection lost';
    if (error.message) {
      errorMsg = error.message;
    } else if (error.localizedDescription) {
      errorMsg = error.localizedDescription;
    } else if (error.toString) {
      errorMsg = error.toString();
    }
    debugLog('=== GET ACCOUNTS ERROR ===');
    debugLog('Error:', errorMsg);
    debugLog('Error type:', typeof error);
    return {
      success: false,
      error: errorMsg
    };
  }
}

/**
 * Get all categories
 * @param {string} token - Authentication token
 * @param {string} type - Optional: 'Income' or 'Expense' to filter by type
 * @returns {Object} { success: boolean, categories: Object, error?: string }
 * 
 * When using attr=name, API returns: { "All": "All", "Category1": "Category1", ... }
 * The "All" option is always included as the first option.
 * 
 * Examples:
 * - getCategories(token) -> Returns all categories with "All" option
 * - getCategories(token, 'Income') -> Returns only Income categories with "All" option
 * - getCategories(token, 'Expense') -> Returns only Expense categories with "All" option
 */
async function getCategories(token, type = null) {
  try {
    debugLog('=== GET CATEGORIES START ===');
    debugLog('Token provided:', !!token);
    debugLog('Token length:', token ? token.length : 0);
    debugLog('Type filter:', type || 'none');
    
    // Validate type parameter if provided
    if (type && !['Income', 'Expense'].includes(type)) {
      debugLog('ERROR: Invalid type');
      return {
        success: false,
        error: `Invalid type: ${type}. Must be 'Income' or 'Expense'`
      };
    }
    
    let url = `${CONFIG.SERVER_URL}/api/categories?attr=name`;
    if (type) {
      url += `&type=${type}`;
    }
    debugLog('URL:', url);
    
    const request = new Request(url);
    request.method = 'GET';
    request.timeoutInterval = 10; // 10 seconds timeout
    request.headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    debugLog('Request headers:', JSON.stringify(request.headers));
    debugLog('Request method:', request.method);
    debugLog('Sending request...');
    
    const response = await request.loadJSON();
    debugLog('Response received');
    
    debugLog('Response keys:', Object.keys(response || {}));
    debugLog('Response has error:', !!(response && response.error));
    
    // Check if response has error
    if (response.error) {
      debugLog('ERROR in response:', response.error);
      debugLog('=== GET CATEGORIES FAILED ===');
      return {
        success: false,
        error: response.error
      };
    }
    
    // When attr=name, API returns object directly: { "All": "All", "Category1": "Category1", ... }
    // The "All" option is always included as the first key
    // When no attr, API returns { categories: [...] }
    if (response.categories) {
      // Full category objects (when not using attr=name)
      debugLog('Categories found in response.categories');
      debugLog('=== GET CATEGORIES SUCCESS ===');
      return {
        success: true,
        categories: response.categories
      };
    } else {
      // Category names object (when using attr=name)
      // Format: { "All": "All", "Category1": "Category1", "Category2": "Category2", ... }
      debugLog('Categories found directly in response');
      debugLog('=== GET CATEGORIES SUCCESS ===');
      return {
        success: true,
        categories: response || {},
        // Helper: get category names as array (excluding "All")
        categoryNames: Object.keys(response || {}).filter(name => name !== 'All')
      };
    }
  } catch (error) {
    // Better error handling for network issues
    let errorMsg = 'Network connection lost';
    if (error.message) {
      errorMsg = error.message;
    } else if (error.localizedDescription) {
      errorMsg = error.localizedDescription;
    } else if (error.toString) {
      errorMsg = error.toString();
    }
    debugLog('=== GET CATEGORIES ERROR ===');
    debugLog('Error:', errorMsg);
    debugLog('Error type:', typeof error);
    return {
      success: false,
      error: errorMsg
    };
  }
}

// ============================================
// ACCOUNT BALANCE HELPERS
// ============================================

/**
 * Get account balance by account name
 */
async function getAccountBalance(token, accountName) {
  try {
    const url = `${CONFIG.SERVER_URL}/api/accounts`;
    const request = new Request(url);
    request.timeoutInterval = 10;
    request.headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    const response = await request.loadJSON();
    
    if (response.error) {
      return {
        success: false,
        error: response.error
      };
    }
    
    const accounts = response.accounts || [];
    const account = accounts.find(acc => acc.name === accountName);
    
    if (!account) {
      return {
        success: false,
        error: `Account "${accountName}" not found`
      };
    }
    
    return {
      success: true,
      balance: parseFloat(account.balance),
      account: account
    };
  } catch (error) {
    let errorMsg = 'Network connection lost';
    if (error.message) {
      errorMsg = error.message;
    } else if (error.localizedDescription) {
      errorMsg = error.localizedDescription;
    }
    return {
      success: false,
      error: errorMsg
    };
  }
}

/**
 * Create a balance adjustment transaction
 * Calculates the adjustment amount and creates Income or Expense transaction
 */
async function createBalanceAdjustment(token, adjustmentData) {
  try {
    const { account_name, new_balance, reason } = adjustmentData;
    
    if (!account_name || new_balance === undefined || !reason) {
      return {
        success: false,
        error: 'Missing required fields: account_name, new_balance, reason'
      };
    }
    
    // Get current account balance
    const balanceResult = await getAccountBalance(token, account_name);
    if (!balanceResult.success) {
      return balanceResult;
    }
    
    const currentBalance = balanceResult.balance;
    const targetBalance = parseFloat(new_balance);
    const adjustmentAmount = targetBalance - currentBalance;
    
    if (adjustmentAmount === 0) {
      return {
        success: false,
        error: 'No adjustment needed - balance is already correct'
      };
    }
    
    // Determine transaction type based on adjustment amount
    const transactionType = adjustmentAmount > 0 ? 'Income' : 'Expense';
    const absoluteAmount = Math.abs(adjustmentAmount);
    
    // Create the transaction with "Balance Adjustment: " prefix
    // Balance adjustments don't require category_name or person_company
    const transactionData = {
      account_name: account_name,
      amount: absoluteAmount,
      type: transactionType,
      description: `Balance Adjustment: ${reason}`
      // Don't include category_name or person_company - they're optional
    };
    
    if (adjustmentData.date_iso) {
      transactionData.date_iso = adjustmentData.date_iso;
    }
    
    return await createTransaction(token, transactionData);
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to create balance adjustment'
    };
  }
}

// ============================================
// TRANSACTION CREATION
// ============================================

/**
 * Build a human-friendly description from the transaction inputs.
 * Used when the caller doesn't provide a description.
 */
function buildAutoDescription(transactionData) {
  const parts = [];
  const type = transactionData.type ? String(transactionData.type) : 'Transaction';
  const amount = transactionData.amount !== undefined && transactionData.amount !== null ? String(transactionData.amount) : '';
  const currency = transactionData.currency ? String(transactionData.currency) : '';

  // Example: "Expense 25 ILS"
  const head = [type, amount, currency].filter(Boolean).join(' ').trim();
  if (head) parts.push(head);

  // Example: "Category: Debt (Loan)"
  if (transactionData.category_name) {
    const cat = String(transactionData.category_name);
    const sub = transactionData.subcategory ? String(transactionData.subcategory) : '';
    parts.push(`Category: ${sub ? `${cat} (${sub})` : cat}`);
  }

  // Example: "Person/Company: John Doe"
  if (transactionData.person_company) {
    parts.push(`Person/Company: ${String(transactionData.person_company)}`);
  }

  // Example: "Account: Cash"
  if (transactionData.account_name) {
    parts.push(`Account: ${String(transactionData.account_name)}`);
  }

  // Example: "Excluded: true"
  if (transactionData.exclude_from_reports !== undefined && transactionData.exclude_from_reports !== null && transactionData.exclude_from_reports !== '') {
    parts.push(`Excluded: ${String(transactionData.exclude_from_reports)}`);
  }

  return parts.join(' | ');
}

/**
 * Create a transaction (Income or Expense)
 */
async function createTransaction(token, transactionData) {
  try {
    const url = `${CONFIG.SERVER_URL}/api/transactions`;
    const request = new Request(url);
    request.method = 'POST';
    request.headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Build transaction payload
    const payload = {
      account_name: transactionData.account_name,
      amount: parseFloat(transactionData.amount),
      type: transactionData.type // 'Income' or 'Expense'
    };
    
    // Optional fields - only include if provided
    if (transactionData.category_name !== undefined && transactionData.category_name !== null && transactionData.category_name !== '') {
      payload.category_name = transactionData.category_name;
    }
    if (transactionData.person_company !== undefined && transactionData.person_company !== null && transactionData.person_company !== '') {
      payload.person_company = transactionData.person_company;
    }
    // Optional: exclude from reports/balances (logging-only transaction)
    // Accepts true/false, 'true'/'false', 1/0
    if (transactionData.exclude_from_reports !== undefined && transactionData.exclude_from_reports !== null && transactionData.exclude_from_reports !== '') {
      payload.exclude_from_reports = transactionData.exclude_from_reports;
    }
    
    // Optional fields
    if (transactionData.description) {
      payload.description = transactionData.description;
    } else {
      // Auto-generate description from inputs if not provided
      payload.description = buildAutoDescription(transactionData);
    }
    if (transactionData.subcategory) {
      payload.subcategory = transactionData.subcategory;
    }
    if (transactionData.date_iso) {
      payload.date_iso = transactionData.date_iso;
    }
    if (transactionData.currency) {
      payload.currency = transactionData.currency;
    }
    
    request.body = JSON.stringify(payload);
    
    const response = await request.loadJSON();
    
    if (response.success && response.transaction) {
      return {
        success: true,
        transaction: response.transaction,
        message: `${transactionData.type} transaction created successfully`
      };
    } else {
      return {
        success: false,
        error: response.error || 'Failed to create transaction'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
}

/**
 * Create a transfer between accounts
 */
async function createTransfer(token, transferData) {
  try {
    const url = `${CONFIG.SERVER_URL}/api/transactions/transfer`;
    const request = new Request(url);
    request.method = 'POST';
    request.headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    const payload = {
      from_account_name: transferData.from_account_name,
      to_account_name: transferData.to_account_name,
      amount: parseFloat(transferData.amount)
    };
    
    // Optional fields
    if (transferData.description) {
      payload.description = transferData.description;
    }
    if (transferData.date_iso) {
      payload.date_iso = transferData.date_iso;
    }
    if (transferData.exchange_rate) {
      payload.exchange_rate = parseFloat(transferData.exchange_rate);
    }
    
    request.body = JSON.stringify(payload);
    
    const response = await request.loadJSON();
    
    if (response.success && response.transfer) {
      return {
        success: true,
        transfer: response.transfer,
        summary: response.summary,
        message: 'Transfer created successfully'
      };
    } else {
      return {
        success: false,
        error: response.error || 'Failed to create transfer'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
}

// ============================================
// MAIN SCRIPT HANDLER
// ============================================

/**
 * Manual debug mode - tests all functions automatically
 */
async function runManualDebug(token) {
  debugLog('=== MANUAL DEBUG MODE START ===');
  const results = {
    token: !!token,
    getAccounts: null,
    getCategories: null,
    getCategoriesIncome: null,
    getCategoriesExpense: null,
    getAccountBalance: null
  };
  
  try {
    // Test getAccounts
    debugLog('\n--- Testing getAccounts ---');
    const accountsResult = await getAccounts(token);
    results.getAccounts = accountsResult.success;
    if (accountsResult.success) {
      debugLog('✅ getAccounts: SUCCESS');
      const accountCount = Object.keys(accountsResult.accounts || {}).length;
      debugLog('Accounts found:', accountCount);
      debugLog('Account names:', Object.keys(accountsResult.accounts || {}));
    } else {
      debugLog('❌ getAccounts: FAILED -', accountsResult.error);
    }
    
    // Test getCategories (all)
    debugLog('\n--- Testing getCategories (all) ---');
    const categoriesResult = await getCategories(token);
    results.getCategories = categoriesResult.success;
    if (categoriesResult.success) {
      debugLog('✅ getCategories: SUCCESS');
      const categoryCount = Object.keys(categoriesResult.categories || {}).length;
      debugLog('Categories found:', categoryCount);
    } else {
      debugLog('❌ getCategories: FAILED -', categoriesResult.error);
    }
    
    // Test getCategories (Income)
    debugLog('\n--- Testing getCategories (Income) ---');
    const incomeCategoriesResult = await getCategories(token, 'Income');
    results.getCategoriesIncome = incomeCategoriesResult.success;
    if (incomeCategoriesResult.success) {
      debugLog('✅ getCategories (Income): SUCCESS');
      debugLog('Income categories found:', Object.keys(incomeCategoriesResult.categories || {}).length);
    } else {
      debugLog('❌ getCategories (Income): FAILED -', incomeCategoriesResult.error);
    }
    
    // Test getCategories (Expense)
    debugLog('\n--- Testing getCategories (Expense) ---');
    const expenseCategoriesResult = await getCategories(token, 'Expense');
    results.getCategoriesExpense = expenseCategoriesResult.success;
    if (expenseCategoriesResult.success) {
      debugLog('✅ getCategories (Expense): SUCCESS');
      debugLog('Expense categories found:', Object.keys(expenseCategoriesResult.categories || {}).length);
    } else {
      debugLog('❌ getCategories (Expense): FAILED -', expenseCategoriesResult.error);
    }
    
    // Test getAccountBalance (if we have accounts)
    if (accountsResult.success && Object.keys(accountsResult.accounts || {}).length > 0) {
      debugLog('\n--- Testing getAccountBalance ---');
      const firstAccountName = Object.keys(accountsResult.accounts)[0];
      debugLog('Testing with account:', firstAccountName);
      const balanceResult = await getAccountBalance(token, firstAccountName);
      results.getAccountBalance = balanceResult.success;
      if (balanceResult.success) {
        debugLog('✅ getAccountBalance: SUCCESS');
        debugLog('Balance:', balanceResult.balance);
        debugLog('Currency:', balanceResult.currency);
      } else {
        debugLog('❌ getAccountBalance: FAILED -', balanceResult.error);
      }
    } else {
      debugLog('⏭️ getAccountBalance: SKIPPED (no accounts available)');
    }
    
    debugLog('\n=== MANUAL DEBUG MODE COMPLETE ===');
    debugLog('Results:', JSON.stringify(results, null, 2));
    
    return {
      success: true,
      message: 'Manual debug completed',
      action: 'manual_debug',
      results: results
    };
  } catch (error) {
    debugLog('=== MANUAL DEBUG MODE ERROR ===');
    debugLog('Error:', error.message || error);
    return {
      success: false,
      error: error.message || 'Manual debug failed',
      action: 'manual_debug',
      results: results
    };
  }
}

/**
 * Main script entry point
 * Called from Shortcuts with parameters, or run manually for testing
 */
async function main() {
  // Get parameters from Shortcuts (passed as scriptParameter)
  const params = args.shortcutParameter || {};
  
  // Check if running manually (no shortcut parameters and MANUAL_DEBUG is enabled)
  const isManualMode = CONFIG.MANUAL_DEBUG && (!params || Object.keys(params).length === 0 || !params.action);
  
  // Get credentials from params or use defaults
  const username = params.username || CONFIG.USERNAME;
  const password = params.password || CONFIG.PASSWORD;
  
  // Get valid token FIRST (all functions will use this token)
  debugLog('=== MAIN FUNCTION START ===');
  debugLog('Manual debug mode:', isManualMode);
  debugLog('Username:', username);
  
  const tokenResult = await getValidToken(username, password);
  debugLog('Token result success:', tokenResult.success);
  debugLog('Token result error:', tokenResult.error);
  debugLog('Token result has token:', !!tokenResult.token);
  
  if (!tokenResult.success) {
    debugLog('=== AUTHENTICATION FAILED IN MAIN ===');
    debugLog('Error:', tokenResult.error);
    return {
      success: false,
      error: `Authentication failed: ${tokenResult.error}`,
      action: isManualMode ? 'manual_debug' : (params.action || 'unknown')
    };
  }
  
  const token = tokenResult.token;
  debugLog('Token obtained, length:', token ? token.length : 0);
  
  // If manual debug mode, run all tests
  if (isManualMode) {
    return await runManualDebug(token);
  }
  
  // Get action type (from shortcut parameters)
  const action = params.action || 'create_transaction';
  debugLog('Action:', action);
  
  // Handle different actions
  switch (action) {
    case 'create_transaction':
      // Create Income or Expense transaction
      if (!params.account_name || !params.amount || !params.type || !params.category_name || !params.person_company) {
        return {
          success: false,
          error: 'Missing required fields: account_name, amount, type, category_name, person_company',
          action: action
        };
      }
      
      const transactionResult = await createTransaction(token, {
        account_name: params.account_name,
        amount: params.amount,
        type: params.type,
        category_name: params.category_name,
        person_company: params.person_company,
        description: params.description,
        subcategory: params.subcategory,
        date_iso: params.date_iso,
        currency: params.currency,
        // Optional: set to true to create a logging-only transaction
        exclude_from_reports: params.exclude_from_reports
      });
      return { ...transactionResult, action: action };
      
    case 'create_transfer':
      // Create transfer between accounts
      if (!params.from_account_name || !params.to_account_name || !params.amount) {
        return {
          success: false,
          error: 'Missing required fields: from_account_name, to_account_name, amount',
          action: action
        };
      }
      
      const transferResult = await createTransfer(token, {
        from_account_name: params.from_account_name,
        to_account_name: params.to_account_name,
        amount: params.amount,
        description: params.description,
        date_iso: params.date_iso,
        exchange_rate: params.exchange_rate
      });
      return { ...transferResult, action: action };
      
    case 'get_accounts':
      // Get list of accounts
      debugLog('=== ACTION: GET ACCOUNTS ===');
      debugLog('Token being used:', !!token);
      debugLog('Token length:', token ? token.length : 0);
      const accountsResult = await getAccounts(token);
      debugLog('Accounts result success:', accountsResult.success);
      debugLog('Accounts result error:', accountsResult.error);
      return { ...accountsResult, action: action };
      
    case 'get_categories':
      // Get list of categories
      debugLog('=== ACTION: GET CATEGORIES ===');
      debugLog('Token being used:', !!token);
      debugLog('Token length:', token ? token.length : 0);
      debugLog('Type filter:', params.type || 'none');
      const categoriesResult = await getCategories(token, params.type);
      debugLog('Categories result success:', categoriesResult.success);
      debugLog('Categories result error:', categoriesResult.error);
      return { ...categoriesResult, action: action };
      
    case 'balance_adjustment':
      // Create balance adjustment transaction
      if (!params.account_name || params.new_balance === undefined || !params.reason) {
        return {
          success: false,
          error: 'Missing required fields: account_name, new_balance, reason',
          action: action
        };
      }
      
      const adjustmentResult = await createBalanceAdjustment(token, {
        account_name: params.account_name,
        new_balance: params.new_balance,
        reason: params.reason,
        date_iso: params.date_iso
      });
      return { ...adjustmentResult, action: action };
      
    case 'get_account_balance':
      // Get account balance by name
      if (!params.account_name) {
        return {
          success: false,
          error: 'Missing required field: account_name',
          action: action
        };
      }
      
      const balanceResult = await getAccountBalance(token, params.account_name);
      return { ...balanceResult, action: action };
      
    case 'login':
      // Force login (refresh token)
      const loginResult = await login(username, password);
      return { ...loginResult, action: action };
      
    default:
      return {
        success: false,
        error: `Unknown action: ${action}`,
        action: action
      };
  }
}

// ============================================
// RUN SCRIPT
// ============================================

// Execute main function and return result
const result = await main();

// Display result
if (CONFIG.DEBUG || CONFIG.MANUAL_DEBUG) {
  debugLog('=== FINAL RESULT ===');
  debugLog('Success:', result.success);
  debugLog('Action:', result.action);
  if (result.error) {
    debugLog('Error:', result.error);
  }
  if (result.message) {
    debugLog('Message:', result.message);
  }
  if (result.results) {
    debugLog('Results:', JSON.stringify(result.results, null, 2));
  }
  
  // If manual debug mode, show results in QuickLook
  if (CONFIG.MANUAL_DEBUG && result.results) {
    let output = '📊 Manual Debug Results\n\n';
    output += `Token: ${result.results.token ? '✅' : '❌'}\n`;
    output += `getAccounts: ${result.results.getAccounts ? '✅' : '❌'}\n`;
    output += `getCategories (all): ${result.results.getCategories ? '✅' : '❌'}\n`;
    output += `getCategories (Income): ${result.results.getCategoriesIncome ? '✅' : '❌'}\n`;
    output += `getCategories (Expense): ${result.results.getCategoriesExpense ? '✅' : '❌'}\n`;
    output += `getAccountBalance: ${result.results.getAccountBalance !== null ? (result.results.getAccountBalance ? '✅' : '❌') : '⏭️ (skipped)'}\n`;
    output += `\n\nFull Result:\n${JSON.stringify(result, null, 2)}`;
    QuickLook.present(output);
  } else if (CONFIG.MANUAL_DEBUG && result.action === 'manual_debug') {
    // Show QuickLook even if no results object (error case)
    let output = '📊 Manual Debug Mode\n\n';
    if (result.success) {
      output += '✅ All tests completed\n';
    } else {
      output += `❌ Error: ${result.error || 'Unknown error'}\n`;
    }
    output += `\n\nFull Result:\n${JSON.stringify(result, null, 2)}`;
    QuickLook.present(output);
  }
}

// Return result to Shortcuts (if called from shortcut)
if (args.shortcutParameter) {
  Script.setShortcutOutput(result);
}

// Show notifications based on action type
// Only show success notifications for transaction-related actions
// Always show error notifications for any action
const transactionActions = ['create_transaction', 'create_transfer', 'balance_adjustment'];
const shouldNotifyOnSuccess = result.action && transactionActions.includes(result.action);

if (result.success) {
  // Only notify for transaction actions
  if (shouldNotifyOnSuccess) {
    const message = result.message || `${result.action || 'Operation'} completed successfully`;
    const notification = new Notification();
    notification.title = 'Finance App';
    notification.body = message;
    notification.schedule();
  }
  // For other actions (get_accounts, get_categories, etc.), silently succeed
} else {
  // Always show error notifications
  const notification = new Notification();
  notification.title = 'Finance App Error';
  notification.body = result.error || 'Operation failed';
  notification.schedule();
}


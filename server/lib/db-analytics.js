const prisma = require('./prisma');
const {
  calculateAnalytics,
  generatePredictions,
  generateSavingsTips,
  calculateSpendingTrends,
  calculateCategoryTrends,
  calculateYearOverYear,
  detectRecurringTransactions,
  calculateSpendingPatterns,
  analyzeMerchants,
  calculateCashFlowCalendar,
  calculateFinancialHealthScore,
  calculateSpendingVelocity,
  generateAIInsights,
  calculateLoansAndDebts,
  calculateExpensesByPerson,
  calculateDebtByPerson
} = require('../analytics');

/**
 * Convert database transaction to analytics format
 */
function dbTransactionToAnalyticsFormat(tx) {
  // Handle both Date objects and ISO strings
  const dateIso = tx.dateIso instanceof Date 
    ? tx.dateIso.toISOString() 
    : (tx.dateIso || tx.date_iso || '');
  
  // Transaction-level exclude overrides category flag
  const txExclude = tx.excludeFromReports === true || tx.excludeFromReports === 1 || tx.excludeFromReports === 'true' || tx.excludeFromReports === '1';
  const categoryExclude = tx.category?.excludeFromReports === true || tx.category?.excludeFromReports === 1 || tx.category?.excludeFromReports === 'true' || tx.category?.excludeFromReports === '1';

  return {
    dateIso: dateIso,
    date: tx.date || (tx.dateIso instanceof Date ? tx.dateIso.toLocaleString() : dateIso),
    account: tx.account?.name || tx.account_name || 'Unknown',
    category: tx.category?.name || tx.category_name || null,
    subcategory: tx.subcategory || null,
    excludeFromReports: txExclude || categoryExclude,
    amount: parseFloat(tx.amount || 0),
    currency: tx.currency || 'ILS',
    convertedAmount: parseFloat(tx.convertedAmount || tx.converted_amount || tx.amount || 0),
    type: tx.type,
    personCompany: tx.personCompany || tx.person_company || null,
    description: tx.description || null
  };
}

/**
 * Get transactions from database (single-user system, no userId filter)
 */
async function getTransactionsFromDB(userId, startDate = null, endDate = null) {
  // Single-user system - no userId filtering needed
  const where = {};

  if (startDate || endDate) {
    where.dateIso = {};
    if (startDate) {
      where.dateIso.gte = new Date(startDate);
    }
    if (endDate) {
      where.dateIso.lte = new Date(endDate);
    }
  }

  const transactions = await prisma.transaction.findMany({
    where,
    include: {
      account: { select: { name: true } },
      category: { 
        select: { 
          name: true, 
          excludeFromReports: true 
        } 
      }
    },
    orderBy: { dateIso: 'asc' }
  });

  return transactions.map(dbTransactionToAnalyticsFormat);
}

/**
 * Get transactions with raw fields (used by list)
 */
async function getTransactionsRawFromDB(where = {}, orderBy = { dateIso: 'desc' }) {
  const transactions = await prisma.transaction.findMany({
    where,
    include: {
      account: { select: { name: true } },
      category: {
        select: {
          name: true,
          excludeFromReports: true
        }
      }
    },
    orderBy
  });
  return transactions;
}

/**
 * Get analytics from database
 */
async function getAnalyticsFromDB(userId, startDate = null, endDate = null) {
  const transactions = await getTransactionsFromDB(userId, startDate, endDate);
  return calculateAnalytics(transactions, startDate, endDate);
}

/**
 * Get predictions from database
 */
async function getPredictionsFromDB(userId, startDate = null, endDate = null) {
  const analytics = await getAnalyticsFromDB(userId, startDate, endDate);
  return generatePredictions(analytics);
}

/**
 * Get savings tips from database
 */
async function getTipsFromDB(userId, startDate = null, endDate = null) {
  const analytics = await getAnalyticsFromDB(userId, startDate, endDate);
  return generateSavingsTips(analytics);
}

/**
 * Get enhanced analytics from database
 */
async function getEnhancedAnalyticsFromDB(userId, startDate = null, endDate = null) {
  const analytics = await getAnalyticsFromDB(userId, startDate, endDate);
  return {
    spendingTrends: calculateSpendingTrends(analytics),
    categoryTrends: calculateCategoryTrends(analytics),
    yearOverYear: calculateYearOverYear(analytics)
  };
}

/**
 * Get recurring transactions from database
 */
async function getRecurringFromDB(userId, startDate = null, endDate = null) {
  const transactions = await getTransactionsFromDB(userId, startDate, endDate);
  const recurring = detectRecurringTransactions(transactions);
  return recurring;
}

/**
 * Get advanced analytics (patterns, merchants, health score, etc.)
 */
async function getAdvancedAnalyticsFromDB(userId, startDate = null, endDate = null) {
  const transactions = await getTransactionsFromDB(userId, startDate, endDate);
  const analytics = calculateAnalytics(transactions, startDate, endDate);
  const predictions = generatePredictions(analytics);
  
  const patterns = calculateSpendingPatterns(transactions);
  const merchants = analyzeMerchants(transactions);
  const cashFlowCalendar = calculateCashFlowCalendar(transactions, startDate, endDate);
  const healthScore = calculateFinancialHealthScore(analytics, predictions);
  const velocity = calculateSpendingVelocity(analytics);
  const insights = generateAIInsights(analytics, predictions, patterns, merchants);
  
  return {
    patterns,
    merchants,
    cashFlowCalendar,
    healthScore,
    velocity,
    insights
  };
}

/**
 * Get spending patterns
 */
async function getSpendingPatternsFromDB(userId, startDate = null, endDate = null) {
  const transactions = await getTransactionsFromDB(userId, startDate, endDate);
  return calculateSpendingPatterns(transactions);
}

/**
 * Get merchant analysis
 */
async function getMerchantsFromDB(userId, startDate = null, endDate = null) {
  const transactions = await getTransactionsFromDB(userId, startDate, endDate);
  return analyzeMerchants(transactions);
}

/**
 * Get cash flow calendar
 */
async function getCashFlowCalendarFromDB(userId, startDate = null, endDate = null) {
  const transactions = await getTransactionsFromDB(userId, startDate, endDate);
  return calculateCashFlowCalendar(transactions, startDate, endDate);
}

/**
 * Get financial health score
 */
async function getFinancialHealthScoreFromDB(userId, startDate = null, endDate = null) {
  const transactions = await getTransactionsFromDB(userId, startDate, endDate);
  const analytics = calculateAnalytics(transactions, startDate, endDate);
  const predictions = generatePredictions(analytics);
  return calculateFinancialHealthScore(analytics, predictions);
}

/**
 * Get spending velocity
 */
async function getSpendingVelocityFromDB(userId, startDate = null, endDate = null) {
  const transactions = await getTransactionsFromDB(userId, startDate, endDate);
  const analytics = calculateAnalytics(transactions, startDate, endDate);
  return calculateSpendingVelocity(analytics);
}

/**
 * Get AI insights
 */
async function getAIInsightsFromDB(userId, startDate = null, endDate = null) {
  const transactions = await getTransactionsFromDB(userId, startDate, endDate);
  const analytics = calculateAnalytics(transactions, startDate, endDate);
  const predictions = generatePredictions(analytics);
  const patterns = calculateSpendingPatterns(transactions);
  const merchants = analyzeMerchants(transactions);
  return generateAIInsights(analytics, predictions, patterns, merchants);
}

/**
 * Get loans and debts tracking
 */
async function getLoansAndDebtsFromDB(userId, startDate = null, endDate = null) {
  const transactions = await getTransactionsFromDB(userId, startDate, endDate);
  return calculateLoansAndDebts(transactions);
}

/**
 * Get expenses by person/company
 */
async function getExpensesByPersonFromDB(userId, startDate = null, endDate = null) {
  const transactions = await getTransactionsFromDB(userId, startDate, endDate);
  return calculateExpensesByPerson(transactions);
}

/**
 * Get debt transactions by person (Debt category)
 */
async function getDebtByPersonFromDB(userId, startDate = null, endDate = null) {
  const transactions = await getTransactionsFromDB(userId, startDate, endDate);
  return calculateDebtByPerson(transactions);
}

module.exports = {
  getTransactionsFromDB,
  getAnalyticsFromDB,
  getPredictionsFromDB,
  getTipsFromDB,
  getEnhancedAnalyticsFromDB,
  getRecurringFromDB,
  getAdvancedAnalyticsFromDB,
  getSpendingPatternsFromDB,
  getMerchantsFromDB,
  getCashFlowCalendarFromDB,
  getFinancialHealthScoreFromDB,
  getSpendingVelocityFromDB,
  getAIInsightsFromDB,
  getLoansAndDebtsFromDB,
  dbTransactionToAnalyticsFormat
};


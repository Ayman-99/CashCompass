const prisma = require('./prisma');
const logger = require('./logger');
const {
  sendBudgetWarning,
  sendLargeTransactionAlert,
  sendMonthlyLimitAlert,
  sendAccountBalanceWarning,
  sendRecurringTransactionAlert
} = require('./discord-webhook');

/**
 * Check all alert rules for a newly created transaction
 * @param {Object} transaction - The newly created transaction
 * @param {Object} user - The user who created the transaction
 */
async function checkAlertRules(transaction, user) {
  try {
    // Get webhook config
    const webhookConfig = await prisma.webhookConfig.findUnique({
      where: { userId: user.id }
    });

    if (!webhookConfig || !webhookConfig.isEnabled || !webhookConfig.webhookUrl) {
      return; // No webhook configured or disabled
    }

    // Get all enabled alert rules for this user
    const alertRules = await prisma.alertRule.findMany({
      where: {
        userId: user.id,
        isEnabled: true
      },
      include: {
        category: true,
        account: true
      }
    });

    if (alertRules.length === 0) {
      return; // No rules configured
    }

    // Get transaction with relations
    const fullTransaction = await prisma.transaction.findUnique({
      where: { id: transaction.id },
      include: {
        account: { select: { name: true, balance: true, currency: true } },
        category: { select: { name: true } }
      }
    });

    const transactionData = {
      id: fullTransaction.id,
      amount: parseFloat(fullTransaction.amount),
      currency: fullTransaction.currency,
      type: fullTransaction.type,
      category: fullTransaction.category?.name || null,
      account: fullTransaction.account?.name || null,
      description: fullTransaction.description || null,
      personCompany: fullTransaction.personCompany || null,
      dateIso: fullTransaction.dateIso
    };

    // Check each rule
    for (const rule of alertRules) {
      try {
        await checkRule(rule, transactionData, fullTransaction, webhookConfig.webhookUrl);
      } catch (error) {
        logger.error(`Error checking rule ${rule.id}:`, error);
        // Continue checking other rules even if one fails
      }
    }
  } catch (error) {
    logger.error('Error in checkAlertRules:', error);
  }
}

/**
 * Check a single alert rule
 */
async function checkRule(rule, transactionData, fullTransaction, webhookUrl) {
  const threshold = parseFloat(rule.threshold);
  const ruleType = rule.ruleType;

  // Skip if rule is for a specific category/account and doesn't match
  // Check multiple categories (categoryIds) first, then single category (categoryId) for backward compatibility
  if (rule.categoryIds && Array.isArray(rule.categoryIds) && rule.categoryIds.length > 0) {
    // Rule applies to multiple categories - check if transaction category is in the list
    if (!rule.categoryIds.includes(fullTransaction.categoryId)) {
      return;
    }
  } else if (rule.categoryId && rule.categoryId !== fullTransaction.categoryId) {
    // Single category rule - check if it matches
    return;
  }
  if (rule.accountId && rule.accountId !== fullTransaction.accountId) {
    return;
  }

  switch (ruleType) {
    case 'LARGE_TRANSACTION':
      if (transactionData.type === 'Expense' && Math.abs(transactionData.amount) >= threshold) {
        await sendLargeTransactionAlert(webhookUrl, transactionData, threshold);
        logger.info(`Large transaction alert sent for transaction ${transactionData.id}`);
      }
      break;

    case 'BUDGET_LIMIT':
      if (transactionData.type === 'Expense') {
        await checkBudgetLimit(rule, transactionData, fullTransaction, webhookUrl, threshold);
      }
      break;

    case 'MONTHLY_LIMIT':
      if (transactionData.type === 'Expense') {
        await checkMonthlyLimit(rule, transactionData, fullTransaction, webhookUrl, threshold);
      }
      break;

    case 'ACCOUNT_BALANCE':
      await checkAccountBalance(rule, transactionData, fullTransaction, webhookUrl, threshold);
      break;

    case 'RECURRING_DETECTION':
      // This would be checked separately, not on every transaction
      break;

    default:
      logger.warn(`Unknown rule type: ${ruleType}`);
  }
}

/**
 * Check budget limit (category or overall)
 */
async function checkBudgetLimit(rule, transactionData, fullTransaction, webhookUrl, threshold) {
  const now = new Date();
  const periodStart = getPeriodStart(rule.period || 'MONTHLY', now);
  const periodId = getPeriodId(rule.period || 'MONTHLY', now);
  
  // Calculate current spending for the period
  const where = {
    userId: fullTransaction.userId,
    type: 'Expense',
    dateIso: { gte: periodStart }
  };

  // Handle multiple categories (categoryIds) first, then single category (categoryId) for backward compatibility
  if (rule.categoryIds && Array.isArray(rule.categoryIds) && rule.categoryIds.length > 0) {
    where.categoryId = { in: rule.categoryIds };
  } else if (rule.categoryId) {
    where.categoryId = rule.categoryId;
  }

  const transactions = await prisma.transaction.findMany({ 
    where,
    include: {
      category: { select: { id: true, name: true, excludeFromReports: true } }
    }
  });
  
  // Filter out transactions from excluded categories
  const regularTransactions = transactions.filter(t => {
    if (!t.category) return true; // Include transactions without categories
    const excludeValue = t.category.excludeFromReports;
    return !(excludeValue === true || excludeValue === 1 || excludeValue === 'true' || excludeValue === '1');
  });
  
  const currentSpending = regularTransactions.reduce((sum, t) => {
    return sum + Math.abs(parseFloat(t.convertedAmount || t.amount));
  }, 0);

  const percentage = (currentSpending / threshold) * 100;
  const lastAlertPct = rule.lastAlertPercentage ? parseFloat(rule.lastAlertPercentage) : 0;
  const lastAlertPeriod = rule.lastAlertPeriod || '';

  // Check for 90% threshold (only if we haven't sent a 90% or 100% alert for this period)
  if (percentage >= 90 && percentage < 100 && lastAlertPct < 90 && lastAlertPeriod !== periodId) {
    await sendBudgetWarning(
      webhookUrl,
      transactionData,
      {
        name: rule.name,
        categoryName: rule.category?.name || 'Overall'
      },
      currentSpending,
      threshold,
      90 // Alert percentage
    );
    
    // Update rule to track that we sent a 90% alert
    await prisma.alertRule.update({
      where: { id: rule.id },
      data: {
        lastAlertPercentage: 90,
        lastAlertPeriod: periodId
      }
    });
    
    logger.info(`Budget limit 90% alert sent for rule ${rule.id}`);
  }
  
  // Check for 100% threshold (only if we haven't sent a 100% alert for this period)
  if (percentage >= 100 && lastAlertPct < 100 && lastAlertPeriod !== periodId) {
    await sendBudgetWarning(
      webhookUrl,
      transactionData,
      {
        name: rule.name,
        categoryName: rule.category?.name || 'Overall'
      },
      currentSpending,
      threshold,
      100 // Alert percentage
    );
    
    // Update rule to track that we sent a 100% alert
    await prisma.alertRule.update({
      where: { id: rule.id },
      data: {
        lastAlertPercentage: 100,
        lastAlertPeriod: periodId
      }
    });
    
    logger.info(`Budget limit 100% alert sent for rule ${rule.id}`);
  }
}

/**
 * Check monthly spending limit
 */
async function checkMonthlyLimit(rule, transactionData, fullTransaction, webhookUrl, threshold) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodId = getPeriodId(rule.period || 'MONTHLY', now);
  
  const where = {
    userId: fullTransaction.userId,
    type: 'Expense',
    dateIso: { gte: monthStart }
  };

  const transactions = await prisma.transaction.findMany({ where });
  const monthlySpending = transactions.reduce((sum, t) => {
    return sum + Math.abs(parseFloat(t.convertedAmount || t.amount));
  }, 0);

  const percentage = (monthlySpending / threshold) * 100;
  const lastAlertPct = rule.lastAlertPercentage ? parseFloat(rule.lastAlertPercentage) : 0;
  const lastAlertPeriod = rule.lastAlertPeriod || '';

  // Check for 90% threshold (only if we haven't sent a 90% or 100% alert for this period)
  if (percentage >= 90 && percentage < 100 && lastAlertPct < 90 && lastAlertPeriod !== periodId) {
    await sendMonthlyLimitAlert(
      webhookUrl,
      transactionData,
      monthlySpending,
      threshold,
      90 // Alert percentage
    );
    
    // Update rule to track that we sent a 90% alert
    await prisma.alertRule.update({
      where: { id: rule.id },
      data: {
        lastAlertPercentage: 90,
        lastAlertPeriod: periodId
      }
    });
    
    logger.info(`Monthly limit 90% alert sent for rule ${rule.id}`);
  }
  
  // Check for 100% threshold (only if we haven't sent a 100% alert for this period)
  if (percentage >= 100 && lastAlertPct < 100 && lastAlertPeriod !== periodId) {
    await sendMonthlyLimitAlert(
      webhookUrl,
      transactionData,
      monthlySpending,
      threshold,
      100 // Alert percentage
    );
    
    // Update rule to track that we sent a 100% alert
    await prisma.alertRule.update({
      where: { id: rule.id },
      data: {
        lastAlertPercentage: 100,
        lastAlertPeriod: periodId
      }
    });
    
    logger.info(`Monthly limit 100% alert sent for rule ${rule.id}`);
  }
}

/**
 * Check account balance
 */
async function checkAccountBalance(rule, transactionData, fullTransaction, webhookUrl, threshold) {
  const account = fullTransaction.account;
  const currentBalance = parseFloat(account.balance);

  if (currentBalance <= threshold) {
    await sendAccountBalanceWarning(
      webhookUrl,
      transactionData,
      account.name,
      currentBalance,
      threshold
    );
    logger.info(`Account balance alert sent for rule ${rule.id}`);
  }
}

/**
 * Get period start date based on period type
 */
function getPeriodStart(period, now) {
  switch (period) {
    case 'DAILY':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'WEEKLY':
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
      return weekStart;
    case 'MONTHLY':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'YEARLY':
      return new Date(now.getFullYear(), 0, 1);
    default:
      return new Date(now.getFullYear(), now.getMonth(), 1); // Default to monthly
  }
}

/**
 * Get period identifier string (for tracking alerts per period)
 */
function getPeriodId(period, now) {
  switch (period) {
    case 'DAILY':
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    case 'WEEKLY':
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      return `${weekStart.getFullYear()}-W${String(Math.ceil((weekStart.getDate() + weekStart.getDay()) / 7)).padStart(2, '0')}`;
    case 'MONTHLY':
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    case 'YEARLY':
      return `${now.getFullYear()}`;
    default:
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; // Default to monthly
  }
}

module.exports = {
  checkAlertRules
};


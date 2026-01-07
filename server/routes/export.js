const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/access');
const { createAuditLog } = require('../lib/audit');
const logger = require('../lib/logger');

const router = express.Router();

// Helper to safely convert date to ISO string
function toISOString(date) {
  if (!date) return null;
  if (date instanceof Date) {
    return date.toISOString();
  }
  if (typeof date === 'string') {
    // Try to parse and convert
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
    return date; // Return as-is if can't parse
  }
  return String(date);
}

// Helper to convert to CSV
function convertToCSV(data, headers) {
  if (!data || data.length === 0) {
    return headers.join(',') + '\n';
  }

  const csvRows = [headers.join(',')];
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header] || '';
      // Escape commas and quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

// Export transactions
router.get('/transactions', requireAuth, async (req, res) => {
  try {
    const { format = 'json' } = req.query;

    // Get all transactions (single-user system)
    const transactions = await prisma.transaction.findMany({
      orderBy: { date: 'desc' },
      include: {
        account: {
          select: { name: true, currency: true }
        },
        category: {
          select: { name: true, type: true }
        }
      }
    });

    // Audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'EXPORT',
      entityType: 'Transaction',
      entityId: null,
      ipAddress: req.auditInfo?.ipAddress,
      userAgent: req.auditInfo?.userAgent,
      description: `Exported ${transactions.length} transactions as ${format.toUpperCase()}`
    });

    if (format === 'csv') {
      const headers = ['ID', 'Date', 'Type', 'Amount', 'Currency', 'Account', 'Category', 'Description', 'Person/Company', 'Created At'];
      const csvData = transactions.map(t => ({
        'ID': t.id,
        'Date': toISOString(t.date)?.split('T')[0] || '',
        'Type': t.type,
        'Amount': t.amount.toString(),
        'Currency': t.account.currency,
        'Account': t.account.name,
        'Category': t.category?.name || 'N/A',
        'Description': t.description || '',
        'Person/Company': t.personCompany || '',
        'Created At': toISOString(t.createdAt) || ''
      }));

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=transactions_${new Date().toISOString().split('T')[0]}.csv`);
      res.send(convertToCSV(csvData, headers));
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=transactions_${new Date().toISOString().split('T')[0]}.json`);
      res.json({
        exportDate: new Date().toISOString(),
        totalRecords: transactions.length,
        transactions: transactions.map(t => ({
          id: t.id,
          date: toISOString(t.date),
          type: t.type,
          amount: t.amount.toString(),
          currency: t.account.currency,
          accountId: t.accountId,
          accountName: t.account.name,
          categoryId: t.categoryId,
          categoryName: t.category?.name,
          categoryType: t.category?.type,
          description: t.description,
          personCompany: t.personCompany,
          createdAt: toISOString(t.createdAt),
          updatedAt: toISOString(t.updatedAt)
        }))
      });
    }
  } catch (error) {
    console.error('Export transactions error:', error);
    res.status(500).json({ error: 'Failed to export transactions' });
  }
});

// Export accounts
router.get('/accounts', requireAuth, async (req, res) => {
  try {
    const accounts = await prisma.account.findMany({
      orderBy: { name: 'asc' }
    });

    await createAuditLog({
      userId: req.user.id,
      action: 'EXPORT',
      entityType: 'Account',
      entityId: null,
      ipAddress: req.auditInfo?.ipAddress,
      userAgent: req.auditInfo?.userAgent,
      description: `Exported ${accounts.length} accounts`
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=accounts_${new Date().toISOString().split('T')[0]}.json`);
    res.json({
      exportDate: new Date().toISOString(),
      totalRecords: accounts.length,
      accounts: accounts.map(a => ({
        id: a.id,
        name: a.name,
        currency: a.currency,
        balance: a.balance.toString(),
        createdAt: toISOString(a.createdAt),
        updatedAt: toISOString(a.updatedAt)
      }))
    });
  } catch (error) {
    console.error('Export accounts error:', error);
    res.status(500).json({ error: 'Failed to export accounts' });
  }
});

// Export categories
router.get('/categories', requireAuth, async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: [{ type: 'asc' }, { name: 'asc' }]
    });

    await createAuditLog({
      userId: req.user.id,
      action: 'EXPORT',
      entityType: 'Category',
      entityId: null,
      ipAddress: req.auditInfo?.ipAddress,
      userAgent: req.auditInfo?.userAgent,
      description: `Exported ${categories.length} categories`
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=categories_${new Date().toISOString().split('T')[0]}.json`);
    res.json({
      exportDate: new Date().toISOString(),
      totalRecords: categories.length,
      categories: categories.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        subcategory: c.subcategory,
        excludeFromReports: c.excludeFromReports || false,
        createdAt: toISOString(c.createdAt),
        updatedAt: toISOString(c.updatedAt)
      }))
    });
  } catch (error) {
    console.error('Export categories error:', error);
    res.status(500).json({ error: 'Failed to export categories' });
  }
});

// Export currencies
router.get('/currencies', requireAuth, async (req, res) => {
  try {
    const currencies = await prisma.currency.findMany({
      orderBy: { code: 'asc' }
    });

    await createAuditLog({
      userId: req.user.id,
      action: 'EXPORT',
      entityType: 'Currency',
      entityId: null,
      ipAddress: req.auditInfo?.ipAddress,
      userAgent: req.auditInfo?.userAgent,
      description: `Exported ${currencies.length} currencies`
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=currencies_${new Date().toISOString().split('T')[0]}.json`);
    res.json({
      exportDate: new Date().toISOString(),
      totalRecords: currencies.length,
      currencies: currencies.map(c => ({
        id: c.id,
        code: c.code,
        name: c.name,
        rateToILS: c.rateToILS.toString(),
        isBase: c.isBase,
        isActive: c.isActive,
        lastUpdated: toISOString(c.lastUpdated),
        createdAt: toISOString(c.createdAt),
        updatedAt: toISOString(c.updatedAt)
      }))
    });
  } catch (error) {
    console.error('Export currencies error:', error);
    res.status(500).json({ error: 'Failed to export currencies' });
  }
});

// Export all data
router.get('/all', requireAuth, async (req, res) => {
  try {
    const [transactions, accounts, categories, currencies, alertRules, webhookConfig] = await Promise.all([
      prisma.transaction.findMany({
        orderBy: { dateIso: 'desc' },
        include: {
          account: { select: { name: true, currency: true } },
          category: { select: { name: true, type: true } }
        }
      }),
      prisma.account.findMany({ orderBy: { name: 'asc' } }),
      prisma.category.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] }),
      prisma.currency.findMany({ orderBy: { code: 'asc' } }),
      prisma.alertRule.findMany({
        include: {
          category: { select: { id: true, name: true } },
          account: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.webhookConfig.findFirst({})
    ]);

    await createAuditLog({
      userId: req.user.id,
      action: 'EXPORT',
      entityType: 'All',
      entityId: null,
      ipAddress: req.auditInfo?.ipAddress,
      userAgent: req.auditInfo?.userAgent,
      description: `Exported complete data: ${transactions.length} transactions, ${accounts.length} accounts, ${categories.length} categories, ${currencies.length} currencies, ${alertRules.length} alert rules, ${webhookConfig ? 1 : 0} webhook config`
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=complete_export_${new Date().toISOString().split('T')[0]}.json`);
    res.json({
      exportDate: new Date().toISOString(),
      version: '2.0',
      summary: {
        transactions: transactions.length,
        accounts: accounts.length,
        categories: categories.length,
        currencies: currencies.length,
        alertRules: alertRules.length,
        webhookConfig: webhookConfig ? 1 : 0
      },
      data: {
        transactions: transactions.map(t => ({
          id: t.id,
          dateIso: toISOString(t.dateIso),
          date: toISOString(t.date),
          type: t.type,
          amount: t.amount.toString(),
          currency: t.currency,
          convertedAmount: t.convertedAmount.toString(),
          accountId: t.accountId,
          accountName: t.account?.name,
          categoryId: t.categoryId,
          categoryName: t.category?.name,
          categoryType: t.category?.type,
          subcategory: t.subcategory,
          personCompany: t.personCompany,
          description: t.description,
          createdAt: toISOString(t.createdAt),
          updatedAt: toISOString(t.updatedAt)
        })),
        accounts: accounts.map(a => ({
          id: a.id,
          name: a.name,
          currency: a.currency,
          balance: a.balance.toString(),
          initialBalance: a.initialBalance ? a.initialBalance.toString() : a.balance.toString(),
          createdAt: toISOString(a.createdAt),
          updatedAt: toISOString(a.updatedAt)
        })),
        categories: categories.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type,
          subcategory: c.subcategory,
          excludeFromReports: c.excludeFromReports || false,
          createdAt: toISOString(c.createdAt),
          updatedAt: toISOString(c.updatedAt)
        })),
        currencies: currencies.map(c => ({
          id: c.id,
          code: c.code,
          name: c.name,
          rateToILS: c.rateToILS.toString(),
          isBase: c.isBase,
          isActive: c.isActive,
          lastUpdated: toISOString(c.lastUpdated),
          createdAt: toISOString(c.createdAt),
          updatedAt: toISOString(c.updatedAt)
        })),
        alertRules: alertRules.map(r => ({
          id: r.id,
          name: r.name,
          ruleType: r.ruleType,
          isEnabled: r.isEnabled,
          threshold: r.threshold.toString(),
          currency: r.currency,
          categoryId: r.categoryId,
          categoryIds: r.categoryIds,
          accountId: r.accountId,
          period: r.period,
          lastAlertPercentage: r.lastAlertPercentage ? r.lastAlertPercentage.toString() : null,
          lastAlertPeriod: r.lastAlertPeriod,
          categoryName: r.category?.name,
          accountName: r.account?.name,
          createdAt: toISOString(r.createdAt),
          updatedAt: toISOString(r.updatedAt)
        })),
        webhookConfig: webhookConfig ? {
          id: webhookConfig.id,
          webhookUrl: webhookConfig.webhookUrl,
          isEnabled: webhookConfig.isEnabled,
          createdAt: toISOString(webhookConfig.createdAt),
          updatedAt: toISOString(webhookConfig.updatedAt)
        } : null
      }
    });
  } catch (error) {
    console.error('Export all error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Import all data (merge mode - creates new, updates existing)
router.post('/import', requireAuth, async (req, res) => {
  try {
    const { data, options = {} } = req.body;
    const mergeStrategy = options.mergeStrategy || 'max'; // 'max', 'add', 'replace', 'skip'

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Invalid import data. Expected JSON object with data property.' });
    }

    const results = {
      accounts: { created: 0, updated: 0, skipped: 0, errors: [] },
      categories: { created: 0, updated: 0, skipped: 0, errors: [] },
      currencies: { created: 0, updated: 0, skipped: 0, errors: [] },
      transactions: { created: 0, skipped: 0, errors: [] },
      alertRules: { created: 0, updated: 0, skipped: 0, errors: [] },
      webhookConfig: { created: 0, updated: 0, skipped: 0, errors: [] }
    };

    // Import currencies first (needed for transactions)
    if (data.currencies && Array.isArray(data.currencies)) {
      for (const currencyData of data.currencies) {
        try {
          // Single-user system - no userId filter
          const existing = await prisma.currency.findFirst({
            where: {
              code: currencyData.code
            }
          });

          if (existing) {
            // Update existing currency
            await prisma.currency.update({
              where: { id: existing.id },
              data: {
                name: currencyData.name || existing.name,
                rateToILS: currencyData.rateToILS ? parseFloat(currencyData.rateToILS) : existing.rateToILS,
                isBase: currencyData.isBase !== undefined ? currencyData.isBase : existing.isBase,
                isActive: currencyData.isActive !== undefined ? currencyData.isActive : existing.isActive
              }
            });
            results.currencies.updated++;
          } else {
            // Create new currency
            await prisma.currency.create({
              data: {
                userId: req.user.id,
                code: currencyData.code,
                name: currencyData.name || currencyData.code,
                rateToILS: currencyData.rateToILS ? parseFloat(currencyData.rateToILS) : 1.0,
                isBase: currencyData.isBase || false,
                isActive: currencyData.isActive !== undefined ? currencyData.isActive : true
              }
            });
            results.currencies.created++;
          }
        } catch (error) {
          results.currencies.errors.push({ code: currencyData.code, error: error.message });
        }
      }
    }

    // Import accounts (needed for transactions)
    if (data.accounts && Array.isArray(data.accounts)) {
      for (const accountData of data.accounts) {
        try {
          const existing = await prisma.account.findFirst({
            where: {
              name: accountData.name
            }
          });

          if (existing) {
            // Update existing account (merge balances based on strategy)
            const existingBalance = parseFloat(existing.balance);
            const importedBalance = accountData.balance ? parseFloat(accountData.balance) : 0;
            
            let newBalance;
            switch (mergeStrategy) {
              case 'add':
                // Add imported balance to existing
                newBalance = existingBalance + importedBalance;
                break;
              case 'replace':
                // Replace with imported balance
                newBalance = importedBalance;
                break;
              case 'skip':
                // Keep existing balance, skip update
                results.accounts.skipped++;
                continue;
              case 'max':
              default:
                // Use the higher balance (default)
                newBalance = Math.max(existingBalance, importedBalance);
                break;
            }

            await prisma.account.update({
              where: { id: existing.id },
              data: {
                currency: accountData.currency || existing.currency,
                balance: newBalance
              }
            });
            results.accounts.updated++;
          } else {
            // Create new account
            await prisma.account.create({
              data: {
                userId: req.user.id,
                name: accountData.name,
                currency: accountData.currency || 'ILS',
                balance: accountData.balance ? parseFloat(accountData.balance) : 0
              }
            });
            results.accounts.created++;
          }
        } catch (error) {
          results.accounts.errors.push({ name: accountData.name, error: error.message });
        }
      }
    }

    // Import categories (needed for transactions)
    if (data.categories && Array.isArray(data.categories)) {
      for (const categoryData of data.categories) {
        try {
          // Single-user system - no userId filter
          const existing = await prisma.category.findFirst({
            where: {
              name: categoryData.name,
              type: categoryData.type,
              subcategory: categoryData.subcategory || null
            }
          });

          if (existing) {
            // Update existing category if excludeFromReports is provided
            if (categoryData.excludeFromReports !== undefined) {
              await prisma.category.update({
                where: { id: existing.id },
                data: {
                  excludeFromReports: categoryData.excludeFromReports === true || categoryData.excludeFromReports === 'true'
                }
              });
              results.categories.updated++;
            } else {
              results.categories.skipped++;
            }
          } else {
            // Create new category
            await prisma.category.create({
              data: {
                userId: req.user.id,
                name: categoryData.name,
                type: categoryData.type,
                subcategory: categoryData.subcategory || null,
                excludeFromReports: categoryData.excludeFromReports === true || categoryData.excludeFromReports === 'true' || false
              }
            });
            results.categories.created++;
          }
        } catch (error) {
          results.categories.errors.push({ name: categoryData.name, error: error.message });
        }
      }
    }

    // Import transactions (check for duplicates by date + amount + account + description)
    if (data.transactions && Array.isArray(data.transactions)) {
      for (const transactionData of data.transactions) {
        try {
          // Find account by name
          const account = await prisma.account.findFirst({
            where: { name: transactionData.accountName || transactionData.account }
          });

          if (!account) {
            results.transactions.errors.push({
              date: transactionData.date,
              error: `Account "${transactionData.accountName || transactionData.account}" not found`
            });
            continue;
          }

          // Find category if provided (single-user system - no userId filter)
          let categoryId = null;
          if (transactionData.categoryName) {
            const category = await prisma.category.findFirst({
              where: {
                name: transactionData.categoryName,
                type: transactionData.categoryType || transactionData.type
              }
            });
            if (category) {
              categoryId = category.id;
            }
          } else if (transactionData.categoryId) {
            // Check if category exists
            const category = await prisma.category.findUnique({
              where: { id: transactionData.categoryId }
            });
            if (category) {
              categoryId = transactionData.categoryId;
            }
          }

          // Parse transaction date - prefer dateIso, fallback to date
          let transactionDate;
          if (transactionData.dateIso) {
            transactionDate = new Date(transactionData.dateIso);
          } else if (transactionData.date) {
            transactionDate = new Date(transactionData.date);
          } else {
            transactionDate = new Date();
          }

          if (isNaN(transactionDate.getTime())) {
            transactionDate = new Date();
          }
          
          // Use dateIso for the dateIso field, or convert date to ISO
          const dateIsoValue = transactionData.dateIso ? new Date(transactionData.dateIso) : transactionDate;
          const dateString = transactionData.date || transactionDate.toLocaleString();

          const amount = parseFloat(transactionData.amount) || 0;

          const existing = await prisma.transaction.findFirst({
            where: {
              accountId: account.id,
              dateIso: dateIsoValue,
              amount: amount,
              description: transactionData.description || null,
              type: transactionData.type
            }
          });

          if (existing) {
            // Transaction already exists, skip
            results.transactions.skipped++;
            continue;
          }

          // Calculate convertedAmount (convert to account's currency)
          let convertedAmount = amount;
          const transactionCurrency = transactionData.currency || account.currency;
          
          if (transactionCurrency !== account.currency) {
            // Need to convert
            const { convertCurrency } = require('../lib/currency');
            try {
              const converted = await convertCurrency(req.user.id, Math.abs(amount), transactionCurrency, account.currency);
              if (converted !== null) {
                convertedAmount = converted;
              }
            } catch (error) {
              // If conversion fails, use amount as-is
              convertedAmount = amount;
            }
          }

          // Create new transaction
          await prisma.transaction.create({
            data: {
              userId: req.user.id,
              accountId: account.id,
              categoryId: categoryId,
              dateIso: dateIsoValue,
              date: dateString,
              amount: amount,
              currency: transactionCurrency,
              convertedAmount: transactionData.convertedAmount ? parseFloat(transactionData.convertedAmount) : convertedAmount,
              type: transactionData.type,
              subcategory: transactionData.subcategory || null,
              personCompany: transactionData.personCompany || null,
              description: transactionData.description || null
            }
          });

          // Update account balance
          if (transactionData.type === 'Income') {
            await prisma.account.update({
              where: { id: account.id },
              data: { balance: { increment: convertedAmount } }
            });
          } else if (transactionData.type === 'Expense') {
            await prisma.account.update({
              where: { id: account.id },
              data: { balance: { decrement: convertedAmount } }
            });
          }

          results.transactions.created++;
        } catch (error) {
          results.transactions.errors.push({
            date: transactionData.date,
            error: error.message
          });
        }
      }
    }

    // Import alert rules
    if (data.alertRules && Array.isArray(data.alertRules)) {
      for (const ruleData of data.alertRules) {
        try {
          // Find category and account by name if provided
          let categoryId = null;
          let accountId = null;
          
          if (ruleData.categoryName) {
            const category = await prisma.category.findFirst({
              where: {
                name: ruleData.categoryName,
                type: ruleData.categoryType || 'Expense'
              }
            });
            if (category) categoryId = category.id;
          } else if (ruleData.categoryId) {
            const category = await prisma.category.findUnique({
              where: { id: ruleData.categoryId }
            });
            if (category) categoryId = ruleData.categoryId;
          }
          
          if (ruleData.accountName) {
            const account = await prisma.account.findFirst({
              where: { name: ruleData.accountName }
            });
            if (account) accountId = account.id;
          } else if (ruleData.accountId) {
            const account = await prisma.account.findUnique({
              where: { id: ruleData.accountId }
            });
            if (account) accountId = ruleData.accountId;
          }
          
          // Check if rule already exists by name
          const existing = await prisma.alertRule.findFirst({
            where: {
              name: ruleData.name
            }
          });
          
          if (existing) {
            // Update existing rule
            await prisma.alertRule.update({
              where: { id: existing.id },
              data: {
                ruleType: ruleData.ruleType || existing.ruleType,
                isEnabled: ruleData.isEnabled !== undefined ? ruleData.isEnabled : existing.isEnabled,
                threshold: ruleData.threshold ? parseFloat(ruleData.threshold) : existing.threshold,
                currency: ruleData.currency || existing.currency,
                categoryId: categoryId !== null ? categoryId : existing.categoryId,
                categoryIds: ruleData.categoryIds || existing.categoryIds,
                accountId: accountId !== null ? accountId : existing.accountId,
                period: ruleData.period || existing.period
              }
            });
            results.alertRules.updated++;
          } else {
            // Create new rule
            await prisma.alertRule.create({
              data: {
                userId: req.user.id,
                name: ruleData.name,
                ruleType: ruleData.ruleType,
                isEnabled: ruleData.isEnabled !== undefined ? ruleData.isEnabled : true,
                threshold: parseFloat(ruleData.threshold),
                currency: ruleData.currency || 'ILS',
                categoryId: categoryId,
                categoryIds: ruleData.categoryIds || null,
                accountId: accountId,
                period: ruleData.period || null
              }
            });
            results.alertRules.created++;
          }
        } catch (error) {
          results.alertRules.errors.push({ name: ruleData.name, error: error.message });
        }
      }
    }

    // Import webhook config
    if (data.webhookConfig && typeof data.webhookConfig === 'object') {
      try {
        // Single-user system - only one webhook config
        const existing = await prisma.webhookConfig.findFirst({
          where: {}
        });
        
        if (existing) {
          // Update existing webhook config
          await prisma.webhookConfig.update({
            where: { id: existing.id },
            data: {
              webhookUrl: data.webhookConfig.webhookUrl || existing.webhookUrl,
              isEnabled: data.webhookConfig.isEnabled !== undefined ? data.webhookConfig.isEnabled : existing.isEnabled
            }
          });
          results.webhookConfig.updated++;
        } else if (data.webhookConfig.webhookUrl) {
          // Create new webhook config
          await prisma.webhookConfig.create({
            data: {
              userId: req.user.id,
              webhookUrl: data.webhookConfig.webhookUrl,
              isEnabled: data.webhookConfig.isEnabled !== undefined ? data.webhookConfig.isEnabled : true
            }
          });
          results.webhookConfig.created++;
        } else {
          results.webhookConfig.skipped++;
        }
      } catch (error) {
        results.webhookConfig.errors.push({ error: error.message });
      }
    }

    // Audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'IMPORT',
      entityType: 'All',
      entityId: null,
      ipAddress: req.auditInfo?.ipAddress,
      userAgent: req.auditInfo?.userAgent,
      description: `Imported data: ${results.accounts.created + results.accounts.updated} accounts, ${results.categories.created + results.categories.updated} categories, ${results.currencies.created + results.currencies.updated} currencies, ${results.transactions.created} transactions, ${results.alertRules.created + results.alertRules.updated} alert rules, ${results.webhookConfig.created + results.webhookConfig.updated} webhook config`
    });

    logger.info('Data import completed', {
      userId: req.user.id,
      results
    });

    res.json({
      success: true,
      message: 'Data imported successfully',
      results
    });
  } catch (error) {
    console.error('Import error:', error);
    logger.error('Import error', { error: error.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to import data: ' + error.message });
  }
});

module.exports = router;


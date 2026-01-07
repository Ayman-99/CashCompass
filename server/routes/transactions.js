const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/access');
const { createAuditLog } = require('../lib/audit');
const logger = require('../lib/logger');
const { getExchangeRate, convertCurrency, isCurrencySupported } = require('../lib/currency');
const { checkAlertRules } = require('../lib/alert-checker');

const router = express.Router();

// Get all transactions for user
router.get('/', requireAuth, async (req, res) => {
  try {
    const { 
      account_id, 
      category_id, 
      type, 
      startDate, 
      endDate,
      search,
      includeExcluded = 'true',
      excludedOnly = 'false',
      limit = 100,
      offset = 0
    } = req.query;

    // Return all transactions (single-user system)
    const where = {};
    
    if (account_id) where.accountId = parseInt(account_id);
    if (category_id) where.categoryId = parseInt(category_id);
    if (type) where.type = type;
    if (startDate) where.dateIso = { gte: new Date(startDate) };
    if (endDate) {
      where.dateIso = where.dateIso || {};
      where.dateIso.lte = new Date(endDate);
    }
    // Transaction-level exclusion filter (logging-only transactions)
    // Default: include excluded transactions
    const excludedOnlyBool = excludedOnly === 'true';
    const includeExcludedBool = includeExcluded !== 'false';
    if (excludedOnlyBool) {
      where.excludeFromReports = true;
    } else if (!includeExcludedBool) {
      where.excludeFromReports = false;
    }
    if (search) {
      // MySQL doesn't support case-insensitive mode, use contains with case-sensitive search
      // or use raw SQL for case-insensitive
      where.OR = [
        { description: { contains: search } },
        { personCompany: { contains: search } }
      ];
    }

    const take = parseInt(limit);
    const skip = parseInt(offset);

    const [paginatedTransactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          account: { select: { name: true } },
          category: { select: { name: true, excludeFromReports: true } }
        },
        orderBy: { dateIso: 'desc' },
        skip,
        take
      }),
      prisma.transaction.count({ where })
    ]);

    // Format response to match old structure
    const formattedTransactions = paginatedTransactions.map(t => {
      const formatted = {
        ...t,
        account_name: t.account?.name || null,
        category_name: t.category?.name || null,
        // Keep original fields for backward compatibility
        account: t.account?.name || t.account_name || null,
        category: t.category?.name || t.category_name || null
      };
      return formatted;
    });

    res.json({
      transactions: formattedTransactions,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Get single transaction
router.get('/:id', requireAuth, async (req, res) => {
  try {
    // Single-user system, no userId filter
    const transaction = await prisma.transaction.findUnique({
      where: {
        id: parseInt(req.params.id)
      },
      include: {
        account: { select: { name: true } },
        category: { select: { name: true } }
      }
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({
      transaction: {
        ...transaction,
        account_name: transaction.account.name,
        category_name: transaction.category?.name || null
      }
    });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

// Create new transaction
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      account_id,
      account_name, // New: accept account name instead of ID
      category_id,
      category_name, // New: accept category name instead of ID
      exclude_from_reports,
      date_iso,
      date,
      amount,
      currency = 'ILS',
      converted_amount,
      type,
      subcategory,
      person_company,
      description
    } = req.body;

    // Validate required fields
    if (!account_id && !account_name) {
      return res.status(400).json({ error: 'account_id or account_name is required' });
    }
    if (amount === undefined || !type) {
      return res.status(400).json({ error: 'amount and type are required' });
    }

    if (!['Income', 'Expense', 'Transfer'].includes(type)) {
      return res.status(400).json({ error: 'Type must be Income, Expense, or Transfer' });
    }

    // Use current system date if date_iso not provided
    const transactionDate = date_iso ? new Date(date_iso) : new Date();
    const transactionDateString = date || transactionDate.toLocaleString();

    // Get account by ID or name (single-user system, no userId filter)
    let account = null;
    if (account_name) {
      // Look up account by name
      account = await prisma.account.findFirst({
        where: {
          name: account_name.trim()
        }
      });
      
      if (!account) {
        return res.status(404).json({ error: `Account "${account_name}" not found` });
      }
    } else if (account_id) {
      // Look up account by ID
      account = await prisma.account.findUnique({
        where: {
          id: parseInt(account_id)
        }
      });
      
      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }
    }

    const accountCurrency = account.currency;
    const finalCurrency = currency || accountCurrency;
    const finalConvertedAmount = converted_amount !== undefined ? converted_amount : amount;
    const excludeFromReports = exclude_from_reports === true || exclude_from_reports === 1 || exclude_from_reports === 'true' || exclude_from_reports === '1';

    // Handle category: if category_name is provided, find or create category
    // Transfer doesn't have categories
    let finalCategoryId = null;
    if (category_name && type !== 'Transfer') {
      // Transfers don't have categories, so skip for transfers
      try {
        // First, try to find existing category (case-insensitive search)
        // Single-user system: no userId filter needed
        // Normalize category name: trim and collapse multiple spaces
        const categoryNameTrimmed = category_name.trim().replace(/\s+/g, ' ');
        const subcategoryTrimmed = subcategory ? subcategory.trim().replace(/\s+/g, ' ') : null;
        
        // Try exact match first (fastest) - single-user system, no userId filter
        let existingCategory = await prisma.category.findFirst({
          where: {
            name: categoryNameTrimmed,
            type: type,
            subcategory: subcategoryTrimmed
          }
        });
        
        // If not found, try case-insensitive search using raw query
        // This handles cases where category name has different casing (e.g., "Food" vs "food")
        if (!existingCategory) {
          const categories = await prisma.$queryRaw`
            SELECT * FROM categories 
            WHERE LOWER(name) = LOWER(${categoryNameTrimmed})
            AND type = ${type}
            AND (subcategory = ${subcategoryTrimmed} OR (subcategory IS NULL AND ${subcategoryTrimmed} IS NULL))
            LIMIT 1
          `;
          
          if (categories && categories.length > 0) {
            // Convert raw result to Prisma format
            existingCategory = {
              id: categories[0].id,
              name: categories[0].name,
              type: categories[0].type,
              subcategory: categories[0].subcategory,
              excludeFromReports: categories[0].exclude_from_reports || false
            };
            
            logger.info(`Found existing category (case-insensitive): ${categories[0].name}`, {
              userId: req.user.id,
              categoryId: existingCategory.id,
              searchedName: categoryNameTrimmed
            });
          }
        }

        if (existingCategory) {
          // Category exists, use its ID
          finalCategoryId = existingCategory.id;
          logger.info(`Using existing category: ${category_name}`, {
            userId: req.user.id,
            categoryId: finalCategoryId
          });
        } else {
          // Category doesn't exist, create it
          // Use normalized name (trimmed and space-collapsed)
          const newCategory = await prisma.category.create({
            data: {
              userId: req.user.id,
              name: categoryNameTrimmed,
              type: type,
              subcategory: subcategoryTrimmed
            }
          });
          finalCategoryId = newCategory.id;

          // Audit log for auto-created category
          await createAuditLog({
            userId: req.user.id,
            action: 'CREATE',
            entityType: 'Category',
            entityId: newCategory.id,
            newValues: {
              name: newCategory.name,
              type: newCategory.type,
              subcategory: newCategory.subcategory
            },
            ipAddress: req.auditInfo?.ipAddress,
            userAgent: req.auditInfo?.userAgent,
            description: `Category auto-created from transaction: ${category_name}${subcategory ? ` - ${subcategory}` : ''} (${type})`
          });

          logger.info(`Auto-created category: ${category_name}`, {
            userId: req.user.id,
            categoryId: finalCategoryId,
            autoCreated: true
          });
        }
      } catch (error) {
        console.error('Error finding/creating category:', error);
        // If category creation fails, continue without category (don't fail the transaction)
        logger.warn(`Failed to find/create category: ${category_name}`, {
          userId: req.user.id,
          error: error.message
        });
      }
    } else if (category_id) {
      // Use provided category_id if category_name not provided
      finalCategoryId = parseInt(category_id);
    }

    // Use Prisma transaction to update account balance atomically
    const result = await prisma.$transaction(async (tx) => {
      // Create transaction
      const newTransaction = await tx.transaction.create({
        data: {
          userId: req.user.id,
          accountId: account.id, // Use account.id (from lookup by name or ID)
          categoryId: finalCategoryId,
          excludeFromReports,
          dateIso: transactionDate,
          date: transactionDateString,
          amount,
          currency: finalCurrency,
          convertedAmount: finalConvertedAmount,
          type,
          subcategory: subcategory ? subcategory.trim() : null,
          personCompany: person_company ? person_company.trim() : null,
          description: description ? description.trim() : null
        }
      });

      // Update account balance
      // Excluded transactions are logging-only: do not affect balances
      if (!excludeFromReports) {
        if (type === 'Income') {
          await tx.account.update({
            where: { id: account.id },
            data: { balance: { increment: finalConvertedAmount } }
          });
        } else if (type === 'Expense') {
          await tx.account.update({
            where: { id: account.id },
            data: { balance: { decrement: finalConvertedAmount } }
          });
        }
      }
      // Transfer doesn't change balance (handled by two transactions)

      return newTransaction;
    });
    
    // Get the created transaction with relations
    const transaction = await prisma.transaction.findUnique({
      where: { id: result.id },
      include: {
        account: { select: { name: true } },
        category: { select: { name: true } }
      }
    });

    // Audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'CREATE',
      entityType: 'Transaction',
      entityId: result.id,
      newValues: {
        accountId: result.accountId,
        categoryId: result.categoryId,
        categoryName: category_name || null,
        excludeFromReports,
        amount: result.amount.toString(),
        type: result.type,
        subcategory: result.subcategory,
        description: result.description
      },
      ipAddress: req.auditInfo?.ipAddress,
      userAgent: req.auditInfo?.userAgent,
      description: `Transaction created: ${result.type} ${result.convertedAmount} ILS${category_name ? ` - Category: ${category_name}${subcategory ? ` (${subcategory})` : ''}` : ''}${result.description ? ` - ${result.description}` : ''}`
    });

    logger.info(`Transaction created: ${result.type} ${result.convertedAmount} ILS`, {
      userId: req.user.id,
      transactionId: result.id,
      accountId: result.accountId
    });

    // Check alert rules asynchronously (don't block response)
    checkAlertRules(transaction, req.user).catch(error => {
      logger.error('Error checking alert rules:', error);
    });

    res.status(201).json({
      success: true,
      transaction: {
        ...transaction,
        account_name: transaction.account.name,
        category_name: transaction.category?.name || null
      }
    });
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// Update transaction
router.put('/:id', requireAuth, async (req, res) => {
  try {
    // Get existing transaction (single-user system, no userId filter)
    const existing = await prisma.transaction.findUnique({
      where: {
        id: parseInt(req.params.id)
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Get the account to determine its currency (for currency conversion)
    const newAccountId = req.body.account_id !== undefined ? parseInt(req.body.account_id) : existing.accountId;
    const account = await prisma.account.findUnique({
      where: { id: newAccountId }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Calculate converted amount if currency or amount changed
    let finalConvertedAmount = existing.convertedAmount;
    const newCurrency = req.body.currency !== undefined ? req.body.currency : existing.currency;
    const newAmount = req.body.amount !== undefined ? parseFloat(req.body.amount) : parseFloat(existing.amount);
    const accountCurrency = account.currency;

    // If currency changed or amount changed, recalculate convertedAmount
    if (req.body.currency !== undefined || req.body.amount !== undefined || req.body.account_id !== undefined) {
      if (newCurrency === accountCurrency) {
        // Same currency as account, convertedAmount equals amount
        finalConvertedAmount = Math.abs(newAmount);
      } else {
        // Different currency, need to convert to account's currency
        try {
          finalConvertedAmount = await convertCurrency(req.user.id, Math.abs(newAmount), newCurrency, accountCurrency);
          if (finalConvertedAmount === null) {
            return res.status(400).json({ 
              error: `Cannot convert ${newAmount} ${newCurrency} to ${accountCurrency}. Exchange rate not configured.` 
            });
          }
        } catch (error) {
          console.error('Currency conversion error:', error);
          return res.status(400).json({ 
            error: `Failed to convert ${newAmount} ${newCurrency} to ${accountCurrency}: ${error.message}` 
          });
        }
      }
    }

    // Update transaction and adjust account balance
    const updated = await prisma.$transaction(async (tx) => {
      const oldExcluded = existing.excludeFromReports === true || existing.excludeFromReports === 1 || existing.excludeFromReports === 'true' || existing.excludeFromReports === '1';
      const newExcluded = req.body.exclude_from_reports !== undefined
        ? (req.body.exclude_from_reports === true || req.body.exclude_from_reports === 1 || req.body.exclude_from_reports === 'true' || req.body.exclude_from_reports === '1')
        : oldExcluded;

      // Revert old balance change (only if old tx affected balances)
      if (!oldExcluded) {
        if (existing.type === 'Income') {
          await tx.account.update({
            where: { id: existing.accountId },
            data: { balance: { decrement: existing.convertedAmount } }
          });
        } else if (existing.type === 'Expense') {
          await tx.account.update({
            where: { id: existing.accountId },
            data: { balance: { increment: existing.convertedAmount } }
          });
        }
      }

      // Prepare update data
      const updateData = {};
      const fieldMap = {
        account_id: 'accountId',
        category_id: 'categoryId',
        exclude_from_reports: 'excludeFromReports',
        date_iso: 'dateIso',
        date: 'date',
        amount: 'amount',
        currency: 'currency',
        converted_amount: 'convertedAmount',
        type: 'type',
        subcategory: 'subcategory',
        person_company: 'personCompany',
        description: 'description'
      };

      Object.keys(fieldMap).forEach(key => {
        if (req.body[key] !== undefined) {
          const prismaKey = fieldMap[key];
          if (key === 'account_id' || key === 'category_id') {
            updateData[prismaKey] = req.body[key] ? parseInt(req.body[key]) : null;
          } else if (key === 'date_iso') {
            updateData[prismaKey] = new Date(req.body[key]);
          } else if (key === 'exclude_from_reports') {
            updateData[prismaKey] = req.body[key] === true || req.body[key] === 1 || req.body[key] === 'true' || req.body[key] === '1';
          } else {
            updateData[prismaKey] = req.body[key];
          }
        }
      });

      // Always update convertedAmount if it was recalculated
      if (finalConvertedAmount !== existing.convertedAmount) {
        updateData.convertedAmount = finalConvertedAmount;
      }

      if (Object.keys(updateData).length === 0) {
        throw new Error('No fields to update');
      }

      // Update transaction
      const transaction = await tx.transaction.update({
        where: { id: parseInt(req.params.id) },
        data: updateData
      });

      // Apply new balance change
      const newType = req.body.type !== undefined ? req.body.type : existing.type;
      if (!newExcluded) {
        if (newType === 'Income') {
          await tx.account.update({
            where: { id: newAccountId },
            data: { balance: { increment: finalConvertedAmount } }
          });
        } else if (newType === 'Expense') {
          await tx.account.update({
            where: { id: newAccountId },
            data: { balance: { decrement: finalConvertedAmount } }
          });
        }
      }

      return transaction;
    });

    const transaction = await prisma.transaction.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        account: { select: { name: true } },
        category: { select: { name: true } }
      }
    });

    // Audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'UPDATE',
      entityType: 'Transaction',
      entityId: parseInt(req.params.id),
      oldValues: {
        accountId: existing.accountId,
        categoryId: existing.categoryId,
        amount: existing.amount.toString(),
        type: existing.type,
        excludeFromReports: existing.excludeFromReports,
        description: existing.description
      },
      newValues: {
        accountId: updated.accountId,
        categoryId: updated.categoryId,
        amount: updated.amount.toString(),
        type: updated.type,
        excludeFromReports: updated.excludeFromReports,
        description: updated.description
      },
      ipAddress: req.auditInfo?.ipAddress,
      userAgent: req.auditInfo?.userAgent,
      description: `Transaction updated: ${updated.type} ${updated.convertedAmount} ILS`
    });

    logger.info(`Transaction updated: ${updated.id}`, { userId: req.user.id, transactionId: updated.id });

    res.json({
      success: true,
      transaction: {
        ...transaction,
        account_name: transaction.account.name,
        category_name: transaction.category?.name || null
      }
    });
  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// Delete transaction
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    // Get transaction (single-user system, no userId filter)
    const transaction = await prisma.transaction.findUnique({
      where: {
        id: parseInt(req.params.id)
      }
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Get transaction info before deletion for audit
    const transactionInfo = {
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
      amount: transaction.amount.toString(),
      type: transaction.type,
      description: transaction.description
    };

    // For Transfer transactions, find the matching pair
    let matchingTransfer = null;
    if (transaction.type === 'Transfer') {
      // Find matching transfer transaction (opposite sign, same date, different account)
      const transactionDate = new Date(transaction.dateIso);
      const startOfDay = new Date(transactionDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(transactionDate);
      endOfDay.setHours(23, 59, 59, 999);

      matchingTransfer = await prisma.transaction.findFirst({
        where: {
          // Single-user system, no userId filter
          type: 'Transfer',
          id: { not: transaction.id },
          dateIso: {
            gte: startOfDay,
            lte: endOfDay
          },
          accountId: { not: transaction.accountId },
          // Match opposite amount sign (one positive, one negative)
          amount: transaction.amount < 0 ? { gt: 0 } : { lt: 0 }
        }
      });

      // If found, verify it's likely the pair by checking description or amount magnitude
      if (matchingTransfer) {
        const desc1 = (transaction.description || '').toLowerCase();
        const desc2 = (matchingTransfer.description || '').toLowerCase();
        const amount1 = Math.abs(parseFloat(transaction.convertedAmount));
        const amount2 = Math.abs(parseFloat(matchingTransfer.convertedAmount));
        
        // Verify it's a pair: descriptions should mention transfers, or amounts should be similar
        const isLikelyPair = 
          (desc1.includes('transfer') && desc2.includes('transfer')) ||
          (Math.abs(amount1 - amount2) / Math.max(amount1, amount2) < 0.1); // Within 10% difference
        
        if (!isLikelyPair) {
          matchingTransfer = null; // Not a matching pair
        }
      }
    }

    // Delete and revert balance
    await prisma.$transaction(async (tx) => {
      const isExcluded = transaction.excludeFromReports === true || transaction.excludeFromReports === 1 || transaction.excludeFromReports === 'true' || transaction.excludeFromReports === '1';
      // Revert balance change for the main transaction
      if (!isExcluded && transaction.type === 'Income') {
        await tx.account.update({
          where: { id: transaction.accountId },
          data: { balance: { decrement: transaction.convertedAmount } }
        });
      } else if (!isExcluded && transaction.type === 'Expense') {
        await tx.account.update({
          where: { id: transaction.accountId },
          data: { balance: { increment: transaction.convertedAmount } }
        });
      } else if (!isExcluded && transaction.type === 'Transfer') {
        // For transfers, revert the balance change
        // If negative (outgoing), add back to source account
        // If positive (incoming), subtract from destination account
        if (transaction.amount < 0) {
          // Outgoing: add back to source account
          await tx.account.update({
            where: { id: transaction.accountId },
            data: { balance: { increment: Math.abs(transaction.convertedAmount) } }
          });
        } else {
          // Incoming: subtract from destination account
          await tx.account.update({
            where: { id: transaction.accountId },
            data: { balance: { decrement: transaction.convertedAmount } }
          });
        }

        // If matching transfer found, also revert its balance and delete it
        if (matchingTransfer) {
          if (matchingTransfer.amount < 0) {
            // Outgoing: add back to source account
            await tx.account.update({
              where: { id: matchingTransfer.accountId },
              data: { balance: { increment: Math.abs(matchingTransfer.convertedAmount) } }
            });
          } else {
            // Incoming: subtract from destination account
            await tx.account.update({
              where: { id: matchingTransfer.accountId },
              data: { balance: { decrement: matchingTransfer.convertedAmount } }
            });
          }

          // Delete the matching transfer transaction
          await tx.transaction.delete({
            where: { id: matchingTransfer.id }
          });

          // Audit log for matching transfer
          await createAuditLog({
            userId: req.user.id,
            action: 'DELETE',
            entityType: 'Transaction',
            entityId: matchingTransfer.id,
            oldValues: {
              accountId: matchingTransfer.accountId,
              amount: matchingTransfer.amount.toString(),
              type: matchingTransfer.type,
              description: matchingTransfer.description
            },
            ipAddress: req.auditInfo?.ipAddress,
            userAgent: req.auditInfo?.userAgent,
            description: `Transfer pair deleted: ${matchingTransfer.type} ${matchingTransfer.convertedAmount} ILS`
          });
        }
      }

      // Delete the main transaction
      await tx.transaction.delete({
        where: { id: parseInt(req.params.id) }
      });
    });

    // Audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'DELETE',
      entityType: 'Transaction',
      entityId: parseInt(req.params.id),
      oldValues: transactionInfo,
      ipAddress: req.auditInfo?.ipAddress,
      userAgent: req.auditInfo?.userAgent,
      description: matchingTransfer 
        ? `Transfer deleted (both transactions): ${transaction.type} ${transaction.convertedAmount} ILS`
        : `Transaction deleted: ${transaction.type} ${transaction.convertedAmount} ILS`
    });

    logger.info(`Transaction deleted: ${req.params.id}`, { 
      userId: req.user.id, 
      transactionId: parseInt(req.params.id),
      matchingTransferId: matchingTransfer?.id || null
    });

    res.json({ 
      success: true, 
      message: matchingTransfer ? 'Transfer deleted (both transactions)' : 'Transaction deleted',
      deletedPair: matchingTransfer ? true : false
    });
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// Transfer between accounts
router.post('/transfer', requireAuth, async (req, res) => {
  try {
    const {
      from_account_id,
      from_account_name, // New: accept account name instead of ID
      to_account_id,
      to_account_name, // New: accept account name instead of ID
      amount,
      currency,
      date_iso,
      date,
      description,
      exchange_rate // Optional: if provided, used for conversion
    } = req.body;

    // Validate required fields
    if ((!from_account_id && !from_account_name) || (!to_account_id && !to_account_name)) {
      return res.status(400).json({ 
        error: 'from_account_id/from_account_name and to_account_id/to_account_name are required' 
      });
    }
    if (amount === undefined) {
      return res.status(400).json({ 
        error: 'amount is required' 
      });
    }

    // Use current system date if date_iso not provided
    const transferDate = date_iso ? new Date(date_iso) : new Date();
    const transferDateString = date || transferDate.toLocaleString();

    // Get accounts by ID or name (single-user system, no userId filter)
    let fromAccount = null;
    let toAccount = null;

    if (from_account_name) {
      fromAccount = await prisma.account.findFirst({
        where: { name: from_account_name.trim() }
      });
      if (!fromAccount) {
        return res.status(404).json({ error: `Source account "${from_account_name}" not found` });
      }
    } else if (from_account_id) {
      fromAccount = await prisma.account.findUnique({
        where: { id: parseInt(from_account_id) }
      });
      if (!fromAccount) {
        return res.status(404).json({ error: 'Source account not found' });
      }
    }

    if (to_account_name) {
      toAccount = await prisma.account.findFirst({
        where: { name: to_account_name.trim() }
      });
      if (!toAccount) {
        return res.status(404).json({ error: `Destination account "${to_account_name}" not found` });
      }
    } else if (to_account_id) {
      toAccount = await prisma.account.findUnique({
        where: { id: parseInt(to_account_id) }
      });
      if (!toAccount) {
        return res.status(404).json({ error: 'Destination account not found' });
      }
    }

    if (fromAccount.id === toAccount.id) {
      return res.status(400).json({ error: 'Source and destination accounts must be different' });
    }

    if (!fromAccount) {
      return res.status(404).json({ error: 'Source account not found' });
    }

    if (!toAccount) {
      return res.status(404).json({ error: 'Destination account not found' });
    }

    // Determine currencies
    const fromCurrency = currency || fromAccount.currency;
    const toCurrency = toAccount.currency;
    const isSameCurrency = fromCurrency === toCurrency;

    // Validate currencies are configured for user
    if (!(await isCurrencySupported(req.user.id, fromCurrency))) {
      return res.status(400).json({ 
        error: `Currency '${fromCurrency}' is not configured. Please add it in the currency management page.` 
      });
    }
    
    if (!(await isCurrencySupported(req.user.id, toCurrency))) {
      return res.status(400).json({ 
        error: `Currency '${toCurrency}' is not configured. Please add it in the currency management page.` 
      });
    }

    // Calculate converted amounts
    let fromConvertedAmount, toConvertedAmount, usedExchangeRate;
    
    if (isSameCurrency) {
      // Same currency: amounts are equal
      fromConvertedAmount = parseFloat(amount);
      toConvertedAmount = parseFloat(amount);
      usedExchangeRate = 1.0;
    } else {
      // Different currencies: automatically get exchange rate from Frankfurter API or use provided one
      let exchangeRate;
      
      if (exchange_rate !== undefined) {
        // User provided exchange rate (manual override)
        exchangeRate = parseFloat(exchange_rate);
        usedExchangeRate = exchangeRate;
      } else {
        // Automatic exchange rate lookup from database
        exchangeRate = await getExchangeRate(req.user.id, fromCurrency, toCurrency);
        
        if (exchangeRate === null) {
          return res.status(400).json({ 
            error: `Cannot convert from ${fromCurrency} to ${toCurrency}. Exchange rate not configured. Please set up currencies and rates in the currency management page, or provide 'exchange_rate' parameter.` 
          });
        }
        
        usedExchangeRate = exchangeRate;
      }
      
      // Convert from source currency to destination currency
      // Amount in source account's currency (for balance update)
      fromConvertedAmount = parseFloat(amount);
      // Amount in destination account's currency (for balance update)
      toConvertedAmount = await convertCurrency(req.user.id, amount, fromCurrency, toCurrency);
      
      if (toConvertedAmount === null) {
        return res.status(400).json({ 
          error: `Failed to convert ${amount} ${fromCurrency} to ${toCurrency}` 
        });
      }
    }

    // Verify source account has sufficient balance
    if (fromAccount.balance < fromConvertedAmount) {
      return res.status(400).json({ 
        error: `Insufficient balance. Available: ${fromAccount.balance} ${fromAccount.currency}, Required: ${fromConvertedAmount} ${fromCurrency}` 
      });
    }

    // Create both transactions atomically
    const result = await prisma.$transaction(async (tx) => {
      // Create outgoing transaction (negative from source account)
      const outgoingTx = await tx.transaction.create({
        data: {
          userId: req.user.id,
          accountId: fromAccount.id,
          categoryId: null, // Transfers don't have categories
          dateIso: transferDate,
          date: transferDateString,
          amount: -parseFloat(amount), // Negative for outgoing
          currency: fromCurrency,
          convertedAmount: -fromConvertedAmount, // Negative for outgoing
          type: 'Transfer',
          subcategory: null,
          personCompany: null,
          description: description || `Transfer to ${toAccount.name}`
        }
      });

      // Create incoming transaction (positive to destination account)
      // For incoming transaction: amount is in destination currency, convertedAmount is same (account's base currency)
      const incomingAmount = isSameCurrency ? parseFloat(amount) : toConvertedAmount;
      const incomingTx = await tx.transaction.create({
        data: {
          userId: req.user.id,
          accountId: toAccount.id,
          categoryId: null, // Transfers don't have categories
          dateIso: transferDate,
          date: transferDateString,
          amount: incomingAmount, // Amount in destination currency
          currency: toCurrency,
          convertedAmount: toConvertedAmount, // Converted to account's base currency (same as amount for destination account)
          type: 'Transfer',
          subcategory: null,
          personCompany: null,
          description: description || `Transfer from ${fromAccount.name}`
        }
      });

      // Update account balances
      await tx.account.update({
        where: { id: fromAccount.id },
        data: { balance: { decrement: fromConvertedAmount } }
      });

      await tx.account.update({
        where: { id: toAccount.id },
        data: { balance: { increment: toConvertedAmount } }
      });

      return { outgoingTx, incomingTx };
    });

    // Get created transactions with relations
    const [outgoingTransaction, incomingTransaction] = await Promise.all([
      prisma.transaction.findUnique({
        where: { id: result.outgoingTx.id },
        include: {
          account: { select: { name: true } },
          category: { select: { name: true } }
        }
      }),
      prisma.transaction.findUnique({
        where: { id: result.incomingTx.id },
        include: {
          account: { select: { name: true } },
          category: { select: { name: true } }
        }
      })
    ]);

    // Audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'CREATE',
      entityType: 'Transfer',
      entityId: result.outgoingTx.id,
      newValues: {
        fromAccount: fromAccount.name,
        toAccount: toAccount.name,
        amount: amount.toString(),
        fromCurrency,
        toCurrency,
        fromConvertedAmount: fromConvertedAmount.toString(),
        toConvertedAmount: toConvertedAmount.toString(),
        exchangeRate: usedExchangeRate.toString(),
        autoConverted: exchange_rate === undefined && !isSameCurrency
      },
      ipAddress: req.auditInfo?.ipAddress,
      userAgent: req.auditInfo?.userAgent,
      description: `Transfer: ${amount} ${fromCurrency} from ${fromAccount.name} to ${toAccount.name} (${toConvertedAmount} ${toCurrency})`
    });

    logger.info(`Transfer created: ${amount} ${fromCurrency} from ${fromAccount.name} to ${toAccount.name}`, {
      userId: req.user.id,
      outgoingTransactionId: result.outgoingTx.id,
      incomingTransactionId: result.incomingTx.id
    });

    res.status(201).json({
      success: true,
      transfer: {
        outgoing: {
          ...outgoingTransaction,
          account_name: outgoingTransaction.account.name,
          category_name: null
        },
        incoming: {
          ...incomingTransaction,
          account_name: incomingTransaction.account.name,
          category_name: null
        }
      },
      summary: {
        from_account: fromAccount.name,
        to_account: toAccount.name,
        amount: amount,
        from_currency: fromCurrency,
        to_currency: toCurrency,
        from_converted_amount: fromConvertedAmount,
        to_converted_amount: toConvertedAmount,
        exchange_rate: usedExchangeRate,
        auto_converted: exchange_rate === undefined && !isSameCurrency
      }
    });
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({ error: 'Failed to create transfer' });
  }
});

module.exports = router;


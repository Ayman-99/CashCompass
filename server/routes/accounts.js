const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/access');
const { createAuditLog } = require('../lib/audit');
const logger = require('../lib/logger');
const cache = require('../lib/cache');
const { getExchangeRate, convertCurrency } = require('../lib/currency');

const router = express.Router();

// Clear accounts cache when accounts are modified
function clearAccountsCache() {
  cache.delete('accounts_all');
  cache.delete('accounts_all_ils');
  cache.delete('accounts_names');
}

// Get all accounts for user - with caching
router.get('/', requireAuth, async (req, res) => {
  try {
    // Ensure req.user is set
    if (!req.user || !req.user.id) {
      logger.warn('Get accounts: User not authenticated', {
        hasUser: !!req.user,
        hasSession: !!(req.session && req.session.userId),
        hasToken: !!(req.headers['authorization'])
      });
      return res.status(401).json({ error: 'User not authenticated' });
    }

    logger.info('Fetching accounts', { userId: req.user.id, attr: req.query.attr, convertToILS: req.query.convertToILS });

    // Check cache (don't cache if convertToILS is requested, as it requires currency conversion)
    const convertToILS = req.query.convertToILS === 'true';
    const cacheKey = req.query.attr === 'name' ? 'accounts_names' : (convertToILS ? 'accounts_all_ils' : 'accounts_all');
    const cached = cache.get(cacheKey);
    if (cached && !convertToILS) {
      logger.debug('Accounts cache hit', { cacheKey });
      return res.json(cached);
    }

    // Return all accounts (single-user system)
    const accounts = await prisma.account.findMany({
      orderBy: { name: 'asc' }
    });
    
    logger.info('Accounts fetched', { 
      userId: req.user.id, 
      count: accounts.length 
    });
    
    let response;
    // If attr=name, return account names as object { "Name": "Name", ... }
    if (req.query.attr === 'name') {
      const namesObject = {};
      accounts.forEach(account => {
        namesObject[account.name] = account.name;
      });
      response = namesObject;
    } else {
      // If convertToILS is requested, add balanceILS field to each account
      if (convertToILS) {
        const accountsWithILS = await Promise.all(accounts.map(async (account) => {
          const accountCurrency = account.currency || 'ILS';
          const balance = parseFloat(account.balance) || 0;
          
          let balanceILS = balance;
          if (accountCurrency !== 'ILS') {
            try {
              const rate = await getExchangeRate(req.user.id, accountCurrency, 'ILS');
              if (rate !== null) {
                balanceILS = balance * rate;
              } else {
                logger.warn(`Could not convert ${accountCurrency} to ILS for account ${account.name}`);
                balanceILS = balance; // Fallback to original balance
              }
            } catch (error) {
              logger.error(`Error converting ${accountCurrency} to ILS:`, error);
              balanceILS = balance; // Fallback to original balance
            }
          }
          
          return {
            ...account,
            balanceILS: balanceILS
          };
        }));
        
        response = { accounts: accountsWithILS };
      } else {
        response = { accounts: accounts || [] };
      }
    }
    
    // Cache for 5 minutes (only if not converting to ILS, as conversion may change with exchange rates)
    if (!convertToILS) {
      cache.set(cacheKey, response, 5 * 60 * 1000);
    }
    
    res.json(response);
  } catch (error) {
    console.error('Get accounts error:', error);
    logger.error('Get accounts error', { 
      error: error.message, 
      stack: error.stack,
      userId: req.user?.id 
    });
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// Get single account
router.get('/:id', requireAuth, async (req, res) => {
  try {
    // Return account regardless of userId (single-user system)
    const account = await prisma.account.findUnique({
      where: {
        id: parseInt(req.params.id)
      }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json({ account });
  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

// Create new account
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, currency = 'ILS', balance = 0 } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Account name required' });
    }

    // Check if account name already exists (single-user system)
    const existing = await prisma.account.findFirst({
      where: {
        name: name
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Account with this name already exists' });
    }

    const account = await prisma.account.create({
      data: {
        userId: req.user.id,
        name,
        currency,
        balance: parseFloat(balance) || 0
      }
    });

    // Clear cache so the new account appears immediately
    clearAccountsCache();

    // Audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'CREATE',
      entityType: 'Account',
      entityId: account.id,
      newValues: { name, currency, balance },
      ipAddress: req.auditInfo?.ipAddress,
      userAgent: req.auditInfo?.userAgent,
      description: `Account created: ${name}`
    });

    logger.info(`Account created: ${name}`, { userId: req.user.id, accountId: account.id });

    res.status(201).json({
      success: true,
      account
    });
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Update account
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { name, currency, balance } = req.body;

    // Get account (single-user system, no userId check)
    const existing = await prisma.account.findUnique({
      where: {
        id: parseInt(req.params.id)
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (currency !== undefined) updateData.currency = currency;
    if (balance !== undefined) updateData.balance = balance;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Get old values for audit
    const oldValues = {
      name: existing.name,
      currency: existing.currency,
      balance: existing.balance.toString()
    };

    const account = await prisma.account.update({
      where: { id: parseInt(req.params.id) },
      data: updateData
    });

    // Clear cache
    clearAccountsCache();

    // Audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'UPDATE',
      entityType: 'Account',
      entityId: account.id,
      oldValues,
      newValues: {
        name: account.name,
        currency: account.currency,
        balance: account.balance.toString()
      },
      ipAddress: req.auditInfo?.ipAddress,
      userAgent: req.auditInfo?.userAgent,
      description: `Account updated: ${account.name}`
    });

    logger.info(`Account updated: ${account.name}`, { userId: req.user.id, accountId: account.id });

    res.json({
      success: true,
      account
    });
  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// Delete account
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    // Get account (single-user system, no userId check)
    const account = await prisma.account.findUnique({
      where: {
        id: parseInt(req.params.id)
      }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Get account info before deletion for audit
    const accountInfo = {
      name: account.name,
      currency: account.currency,
      balance: account.balance.toString()
    };

    await prisma.account.delete({
      where: { id: parseInt(req.params.id) }
    });

    // Clear cache
    clearAccountsCache();

    // Audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'DELETE',
      entityType: 'Account',
      entityId: parseInt(req.params.id),
      oldValues: accountInfo,
      ipAddress: req.auditInfo?.ipAddress,
      userAgent: req.auditInfo?.userAgent,
      description: `Account deleted: ${accountInfo.name}`
    });

    logger.info(`Account deleted: ${accountInfo.name}`, { userId: req.user.id, accountId: parseInt(req.params.id) });

    res.json({ success: true, message: 'Account deleted' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;


const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/access');
const { createAuditLog } = require('../lib/audit');
const logger = require('../lib/logger');

const router = express.Router();

// Get all currencies (single-user system)
router.get('/', requireAuth, async (req, res) => {
  try {
    const currencies = await prisma.currency.findMany({
      orderBy: [
        { isBase: 'desc' },
        { code: 'asc' }
      ]
    });
    res.json({ currencies });
  } catch (error) {
    console.error('Get currencies error:', error);
    
    // Log to audit trail
    if (req.user?.id) {
      await createAuditLog({
        userId: req.user.id,
        action: 'API_ERROR',
        entityType: 'Currency',
        entityId: null,
        oldValues: null,
        newValues: {
          method: 'GET',
          path: '/api/currencies',
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : null
        },
        ipAddress: req.auditInfo?.ipAddress,
        userAgent: req.auditInfo?.userAgent,
        description: `Error fetching currencies: ${error.message}`
      });
    }
    
    res.status(500).json({ error: 'Failed to fetch currencies' });
  }
});

// Get exchange rate between two currencies (MUST be before /:id route)
router.get('/exchange', requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to currency codes are required' });
    }
    
    // Validate user is authenticated
    if (!req.user || !req.user.id) {
      logger.warn('Exchange rate request without authenticated user', {
        from: req.query.from,
        to: req.query.to,
        hasSession: !!(req.session && req.session.userId)
      });
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { getExchangeRate } = require('../lib/currency');
    
    try {
      const rate = await getExchangeRate(req.user.id, from.toUpperCase(), to.toUpperCase());
      
      // getExchangeRate should never throw - it always returns null on error
      // But we'll handle it just in case
      if (rate === null) {
        // Log to audit trail
        await createAuditLog({
          userId: req.user.id,
          action: 'EXCHANGE_ERROR',
          entityType: 'Currency',
          entityId: null,
          oldValues: null,
          newValues: {
            from: from.toUpperCase(),
            to: to.toUpperCase(),
            error: 'Exchange rate not found',
            reason: 'Currency not configured or inactive'
          },
          ipAddress: req.auditInfo?.ipAddress,
          userAgent: req.auditInfo?.userAgent,
          description: `Exchange rate not found: ${from} to ${to}`
        });
        
        return res.status(400).json({ 
          error: `Exchange rate not found for ${from} to ${to}. Please configure currencies and ensure both currencies are active.` 
        });
      }
      
      // Validate rate is a valid number
      if (isNaN(rate) || !isFinite(rate)) {
        logger.error('Invalid exchange rate calculated', {
          from: from.toUpperCase(),
          to: to.toUpperCase(),
          rate: rate,
          rateType: typeof rate,
          userId: req.user.id
        });
        
        // Log to audit trail
        await createAuditLog({
          userId: req.user.id,
          action: 'EXCHANGE_ERROR',
          entityType: 'Currency',
          entityId: null,
          oldValues: null,
          newValues: {
            from: from.toUpperCase(),
            to: to.toUpperCase(),
            error: 'Invalid exchange rate calculated',
            rate: rate,
            rateType: typeof rate
          },
          ipAddress: req.auditInfo?.ipAddress,
          userAgent: req.auditInfo?.userAgent,
          description: `Invalid exchange rate calculated: ${from} to ${to} (rate: ${rate})`
        });
        
        return res.status(400).json({ 
          error: 'Invalid exchange rate calculated. Please check currency configuration.',
          details: process.env.NODE_ENV === 'development' ? `Rate value: ${rate}, Type: ${typeof rate}` : undefined
        });
      }
      
      res.json({ 
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        rate: rate
      });
    } catch (rateError) {
      // This should never happen since getExchangeRate always returns null on error
      // But we'll log it just in case
      logger.error('Unexpected error in getExchangeRate function (should not happen)', {
        error: rateError.message,
        stack: rateError.stack,
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        userId: req.user.id
      });
      
      // Log to audit trail
      await createAuditLog({
        userId: req.user.id,
        action: 'EXCHANGE_ERROR',
        entityType: 'Currency',
        entityId: null,
        oldValues: null,
        newValues: {
          from: from.toUpperCase(),
          to: to.toUpperCase(),
          error: rateError.message,
          stack: process.env.NODE_ENV === 'development' ? rateError.stack : null
        },
        ipAddress: req.auditInfo?.ipAddress,
        userAgent: req.auditInfo?.userAgent,
        description: `Unexpected error calculating exchange rate: ${from} to ${to} - ${rateError.message}`
      });
      
      return res.status(400).json({ 
        error: 'Failed to calculate exchange rate. Please check currency configuration.',
        details: process.env.NODE_ENV === 'development' ? rateError.message : undefined
      });
    }
  } catch (error) {
    console.error('Get exchange rate error:', error);
    logger.error('Get exchange rate error', {
      error: error.message,
      stack: error.stack,
      from: req.query.from,
      to: req.query.to,
      userId: req.user?.id
    });
    
    // Log to audit trail
    if (req.user?.id) {
      await createAuditLog({
        userId: req.user.id,
        action: 'API_ERROR',
        entityType: 'Currency',
        entityId: null,
        oldValues: null,
        newValues: {
          method: 'GET',
          path: '/api/currencies/exchange',
          error: error.message,
          from: req.query.from,
          to: req.query.to,
          stack: process.env.NODE_ENV === 'development' ? error.stack : null
        },
        ipAddress: req.auditInfo?.ipAddress,
        userAgent: req.auditInfo?.userAgent,
        description: `Error in exchange rate endpoint: ${error.message}`
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to get exchange rate',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get single currency (MUST be after /exchange route)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    // Return currency regardless of userId (single-user system)
    const currency = await prisma.currency.findUnique({
      where: {
        id: parseInt(req.params.id)
      }
    });

    if (!currency) {
      return res.status(404).json({ error: 'Currency not found' });
    }

    res.json({ currency });
  } catch (error) {
    console.error('Get currency error:', error);
    
    // Log to audit trail
    if (req.user?.id) {
      await createAuditLog({
        userId: req.user.id,
        action: 'API_ERROR',
        entityType: 'Currency',
        entityId: parseInt(req.params.id) || null,
        oldValues: null,
        newValues: {
          method: 'GET',
          path: req.path,
          error: error.message,
          currencyId: req.params.id,
          stack: process.env.NODE_ENV === 'development' ? error.stack : null
        },
        ipAddress: req.auditInfo?.ipAddress,
        userAgent: req.auditInfo?.userAgent,
        description: `Error fetching currency ${req.params.id}: ${error.message}`
      });
    }
    
    res.status(500).json({ error: 'Failed to fetch currency' });
  }
});

// Create new currency
router.post('/', requireAuth, async (req, res) => {
  try {
    const { code, name, rateToILS, isBase, isActive } = req.body;

    if (!code || !name || rateToILS === undefined) {
      return res.status(400).json({ error: 'Currency code, name, and rateToILS are required' });
    }

    // If setting as base currency, unset other base currencies (single-user system)
    if (isBase) {
      await prisma.currency.updateMany({
        where: { isBase: true },
        data: { isBase: false }
      });
    }

    // Check if currency code already exists (single-user system)
    const existing = await prisma.currency.findFirst({
      where: {
        code: code.toUpperCase()
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Currency with this code already exists' });
    }

    const currency = await prisma.currency.create({
      data: {
        userId: req.user.id,
        code: code.toUpperCase(),
        name,
        rateToILS: parseFloat(rateToILS),
        isBase: isBase || false,
        isActive: isActive !== undefined ? isActive : true
      }
    });

    // Audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'CREATE',
      entityType: 'Currency',
      entityId: currency.id,
      newValues: { code: currency.code, name: currency.name, rateToILS: currency.rateToILS.toString() },
      ipAddress: req.auditInfo?.ipAddress,
      userAgent: req.auditInfo?.userAgent,
      description: `Currency created: ${currency.code} (${currency.name})`
    });

    logger.info(`Currency created: ${currency.code}`, { userId: req.user.id, currencyId: currency.id });

    res.status(201).json({
      success: true,
      currency
    });
  } catch (error) {
    console.error('Create currency error:', error);
    
    // Log to audit trail
    if (req.user?.id) {
      await createAuditLog({
        userId: req.user.id,
        action: 'API_ERROR',
        entityType: 'Currency',
        entityId: null,
        oldValues: null,
        newValues: {
          method: 'POST',
          path: '/api/currencies',
          error: error.message,
          requestBody: req.body,
          stack: process.env.NODE_ENV === 'development' ? error.stack : null
        },
        ipAddress: req.auditInfo?.ipAddress,
        userAgent: req.auditInfo?.userAgent,
        description: `Error creating currency: ${error.message}`
      });
    }
    
    res.status(500).json({ error: 'Failed to create currency' });
  }
});

// Update currency
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { code, name, rateToILS, isBase, isActive } = req.body;

    // Get currency (single-user system, no userId check)
    const existing = await prisma.currency.findUnique({
      where: {
        id: parseInt(req.params.id)
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Currency not found' });
    }

    // If setting as base currency, unset other base currencies (single-user system)
    if (isBase && !existing.isBase) {
      await prisma.currency.updateMany({
        where: { isBase: true },
        data: { isBase: false }
      });
    }

    const updateData = {};
    if (code !== undefined) updateData.code = code.toUpperCase();
    if (name !== undefined) updateData.name = name;
    if (rateToILS !== undefined) updateData.rateToILS = parseFloat(rateToILS);
    if (isBase !== undefined) updateData.isBase = isBase;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Get old values for audit
    const oldValues = {
      code: existing.code,
      name: existing.name,
      rateToILS: existing.rateToILS.toString(),
      isBase: existing.isBase,
      isActive: existing.isActive
    };

    const currency = await prisma.currency.update({
      where: { id: parseInt(req.params.id) },
      data: updateData
    });

    // Audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'UPDATE',
      entityType: 'Currency',
      entityId: currency.id,
      oldValues,
      newValues: {
        code: currency.code,
        name: currency.name,
        rateToILS: currency.rateToILS.toString(),
        isBase: currency.isBase,
        isActive: currency.isActive
      },
      ipAddress: req.auditInfo?.ipAddress,
      userAgent: req.auditInfo?.userAgent,
      description: `Currency updated: ${currency.code}`
    });

    logger.info(`Currency updated: ${currency.code}`, { userId: req.user.id, currencyId: currency.id });

    res.json({
      success: true,
      currency
    });
  } catch (error) {
    console.error('Update currency error:', error);
    
    // Log to audit trail
    if (req.user?.id) {
      await createAuditLog({
        userId: req.user.id,
        action: 'API_ERROR',
        entityType: 'Currency',
        entityId: parseInt(req.params.id) || null,
        oldValues: null,
        newValues: {
          method: 'PUT',
          path: req.path,
          error: error.message,
          currencyId: req.params.id,
          requestBody: req.body,
          stack: process.env.NODE_ENV === 'development' ? error.stack : null
        },
        ipAddress: req.auditInfo?.ipAddress,
        userAgent: req.auditInfo?.userAgent,
        description: `Error updating currency ${req.params.id}: ${error.message}`
      });
    }
    
    res.status(500).json({ error: 'Failed to update currency' });
  }
});

// Delete currency
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    // Get currency (single-user system, no userId check)
    const currency = await prisma.currency.findUnique({
      where: {
        id: parseInt(req.params.id)
      }
    });

    if (!currency) {
      return res.status(404).json({ error: 'Currency not found' });
    }

    // Prevent deletion of base currency
    if (currency.isBase) {
      return res.status(400).json({ error: 'Cannot delete base currency' });
    }

    // Get currency info before deletion for audit
    const currencyInfo = {
      code: currency.code,
      name: currency.name,
      rateToILS: currency.rateToILS.toString()
    };

    await prisma.currency.delete({
      where: { id: parseInt(req.params.id) }
    });

    // Audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'DELETE',
      entityType: 'Currency',
      entityId: parseInt(req.params.id),
      oldValues: currencyInfo,
      ipAddress: req.auditInfo?.ipAddress,
      userAgent: req.auditInfo?.userAgent,
      description: `Currency deleted: ${currencyInfo.code}`
    });

    logger.info(`Currency deleted: ${currencyInfo.code}`, { userId: req.user.id, currencyId: parseInt(req.params.id) });

    res.json({ success: true, message: 'Currency deleted' });
  } catch (error) {
    console.error('Delete currency error:', error);
    
    // Log to audit trail
    if (req.user?.id) {
      await createAuditLog({
        userId: req.user.id,
        action: 'API_ERROR',
        entityType: 'Currency',
        entityId: parseInt(req.params.id) || null,
        oldValues: null,
        newValues: {
          method: 'DELETE',
          path: req.path,
          error: error.message,
          currencyId: req.params.id,
          stack: process.env.NODE_ENV === 'development' ? error.stack : null
        },
        ipAddress: req.auditInfo?.ipAddress,
        userAgent: req.auditInfo?.userAgent,
        description: `Error deleting currency ${req.params.id}: ${error.message}`
      });
    }
    
    res.status(500).json({ error: 'Failed to delete currency' });
  }
});

// Fetch and update rates from Currency API (fawazahmed0/exchange-api)
router.post('/fetch-rates', requireAuth, async (req, res) => {
  try {
    // Get all active currencies (single-user system)
    const currencies = await prisma.currency.findMany({
      where: {
        isActive: true
      }
    });

    if (currencies.length === 0) {
      return res.status(400).json({ error: 'No active currencies found' });
    }

    // Find base currency (ILS)
    const baseCurrency = currencies.find(c => c.isBase || c.code === 'ILS');
    if (!baseCurrency) {
      return res.status(400).json({ error: 'Base currency (ILS) not found. Please set a base currency.' });
    }

    const baseCode = baseCurrency.code.toLowerCase();
    const updated = [];
    const errors = [];

    // Currency code mapping (normalize to lowercase for API)
    const currencyCodeMap = {
      'JD': 'jod', // Jordanian Dinar
    };

    try {
      // Fetch all rates with base currency from Currency API
      // Primary URL: cdn.jsdelivr.net
      let response = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${baseCode}.json`);
      
      // Fallback to Cloudflare if primary fails
      if (!response.ok) {
        response = await fetch(`https://latest.currency-api.pages.dev/v1/currencies/${baseCode}.json`);
      }

      if (!response.ok) {
        return res.status(400).json({ 
          error: `Failed to fetch rates from Currency API. Status: ${response.status}. Make sure your base currency code "${baseCurrency.code}" is valid.` 
        });
      }

      const data = await response.json();
      
      if (!data[baseCode] || typeof data[baseCode] !== 'object') {
        return res.status(400).json({ 
          error: `Invalid response from Currency API. Base currency "${baseCurrency.code}" may not be supported.` 
        });
      }

      const rates = data[baseCode];

      // Update rates for each currency
      for (const currency of currencies) {
        if (currency.code === baseCurrency.code) {
          // Base currency always has rate 1.0
          await prisma.currency.update({
            where: { id: currency.id },
            data: {
              rateToILS: 1.0,
              lastUpdated: new Date()
            }
          });
          updated.push({ code: currency.code, rate: 1.0 });
          continue;
        }

        try {
          // Get the API currency code (mapped or lowercase)
          const apiCurrencyCode = (currencyCodeMap[currency.code] || currency.code).toLowerCase();
          
          // Get rate from API response
          // API returns: baseCurrency.targetCurrency = rate (meaning 1 baseCurrency = rate targetCurrency)
          // Example: ils.jod = 0.223423 means 1 ILS = 0.223423 JOD
          // But we store rateToILS meaning: 1 targetCurrency = X ILS
          // So we need to invert: rateToILS = 1 / rate
          const rateFromAPI = parseFloat(rates[apiCurrencyCode]);

          if (isNaN(rateFromAPI) || rateFromAPI <= 0) {
            errors.push({ 
              code: currency.code, 
              error: `Currency "${currency.code}" (${apiCurrencyCode}) not found in API response or invalid rate. The currency may not be supported.` 
            });
            continue;
          }

          // Invert the rate: API gives "1 ILS = X JOD", we need "1 JOD = Y ILS"
          // So Y = 1 / X
          const rateToILS = 1 / rateFromAPI;

          // Update currency rate
          await prisma.currency.update({
            where: { id: currency.id },
            data: {
              rateToILS: rateToILS,
              lastUpdated: new Date()
            }
          });

          updated.push({ code: currency.code, rate: rateToILS });
        } catch (error) {
          errors.push({ code: currency.code, error: error.message });
        }
      }
    } catch (error) {
      console.error('Currency API fetch error:', error);
      
      // Log to audit trail
      if (req.user?.id) {
        await createAuditLog({
          userId: req.user.id,
          action: 'API_ERROR',
          entityType: 'Currency',
          entityId: null,
          oldValues: null,
          newValues: {
            method: 'POST',
            path: '/api/currencies/fetch-rates',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : null
          },
          ipAddress: req.auditInfo?.ipAddress,
          userAgent: req.auditInfo?.userAgent,
          description: `Error fetching rates from Currency API: ${error.message}`
        });
      }
      
      return res.status(500).json({ 
        error: `Failed to fetch rates from Currency API: ${error.message}` 
      });
    }

    // Audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'UPDATE',
      entityType: 'Currency',
      entityId: null,
      newValues: { updated: updated.length, errors: errors.length },
      ipAddress: req.auditInfo?.ipAddress,
      userAgent: req.auditInfo?.userAgent,
      description: `Exchange rates fetched from Currency API: ${updated.length} updated, ${errors.length} errors`
    });

    logger.info(`Exchange rates fetched: ${updated.length} updated, ${errors.length} errors`, {
      userId: req.user.id,
      updated: updated.length,
      errors: errors.length
    });

    res.json({
      success: true,
      updated,
      errors,
      message: `Updated ${updated.length} currency rate(s)${errors.length > 0 ? `, ${errors.length} error(s)` : ''}`
    });
  } catch (error) {
    console.error('Fetch rates error:', error);
    
    // Log to audit trail
    if (req.user?.id) {
      await createAuditLog({
        userId: req.user.id,
        action: 'API_ERROR',
        entityType: 'Currency',
        entityId: null,
        oldValues: null,
        newValues: {
          method: 'POST',
          path: '/api/currencies/fetch-rates',
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : null
        },
        ipAddress: req.auditInfo?.ipAddress,
        userAgent: req.auditInfo?.userAgent,
        description: `Error in fetch rates endpoint: ${error.message}`
      });
    }
    
    res.status(500).json({ error: 'Failed to fetch exchange rates' });
  }
});

module.exports = router;


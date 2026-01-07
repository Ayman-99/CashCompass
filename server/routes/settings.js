const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/access');
const { createAuditLog } = require('../lib/audit');
const { getClientIp } = require('../middleware/access');
const logger = require('../lib/logger');

const router = express.Router();

// ===== Discord Webhook Configuration =====

// Get webhook config
router.get('/webhook', requireAuth, async (req, res) => {
  try {
    // Single-user system - NO userId filter
    const webhookConfig = await prisma.webhookConfig.findFirst({
      where: {}
    });

    res.json({
      webhook: webhookConfig ? {
        id: webhookConfig.id,
        webhookUrl: webhookConfig.webhookUrl,
        isEnabled: webhookConfig.isEnabled
      } : null
    });
  } catch (error) {
    console.error('Get webhook config error:', error);
    res.status(500).json({ error: 'Failed to fetch webhook config' });
  }
});

// Create or update webhook config
router.post('/webhook', requireAuth, async (req, res) => {
  try {
    const { webhookUrl, isEnabled } = req.body;

    if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
      return res.status(400).json({ error: 'Invalid Discord webhook URL' });
    }

    // Single-user system - NO userId filter
    const existing = await prisma.webhookConfig.findFirst({
      where: {}
    });

    let webhookConfig;
    if (existing) {
      webhookConfig = await prisma.webhookConfig.update({
        where: { id: existing.id },
        data: {
          webhookUrl,
          isEnabled: isEnabled !== undefined ? isEnabled : true
        }
      });
    } else {
      webhookConfig = await prisma.webhookConfig.create({
        data: {
          userId: req.user.id,
          webhookUrl,
          isEnabled: isEnabled !== undefined ? isEnabled : true
        }
      });
    }

    await createAuditLog({
      userId: req.user.id,
      action: existing ? 'UPDATE' : 'CREATE',
      entityType: 'WebhookConfig',
      entityId: webhookConfig.id,
      newValues: {
        webhookUrl: webhookConfig.webhookUrl,
        isEnabled: webhookConfig.isEnabled
      },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      description: `${existing ? 'Updated' : 'Created'} Discord webhook configuration`
    });

    res.json({
      success: true,
      webhook: {
        id: webhookConfig.id,
        webhookUrl: webhookConfig.webhookUrl,
        isEnabled: webhookConfig.isEnabled
      }
    });
  } catch (error) {
    console.error('Create/update webhook config error:', error);
    res.status(500).json({ error: 'Failed to save webhook config' });
  }
});

// Delete webhook config
router.delete('/webhook', requireAuth, async (req, res) => {
  try {
    // Single-user system - NO userId filter
    const existing = await prisma.webhookConfig.findFirst({
      where: {}
    });

    if (existing) {
      await prisma.webhookConfig.delete({
        where: { id: existing.id }
      });

      await createAuditLog({
        userId: req.user.id,
        action: 'DELETE',
        entityType: 'WebhookConfig',
        entityId: existing.id,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        description: 'Deleted Discord webhook configuration'
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete webhook config error:', error);
    res.status(500).json({ error: 'Failed to delete webhook config' });
  }
});

// Test webhook
router.post('/webhook/test', requireAuth, async (req, res) => {
  try {
    // Single-user system - NO userId filter
    const webhookConfig = await prisma.webhookConfig.findFirst({
      where: {}
    });

    if (!webhookConfig || !webhookConfig.webhookUrl) {
      return res.status(400).json({ error: 'Webhook not configured' });
    }

    if (!webhookConfig.isEnabled) {
      return res.status(400).json({ error: 'Webhook is disabled' });
    }

    // Import Discord webhook functions
    const { sendDiscordWebhook, createTransactionAlertEmbed } = require('../lib/discord-webhook');

    // Create a test alert embed
    const testEmbed = createTransactionAlertEmbed({
      title: '🧪 Test Alert',
      description: 'This is a test alert from your Finance App. If you received this, your webhook is configured correctly!',
      color: 0x00ff00, // Green
      transaction: {
        id: 0,
        amount: 100,
        currency: 'ILS',
        type: 'Expense',
        category: 'Test Category',
        account: 'Test Account',
        description: 'Test transaction for webhook verification',
        personCompany: 'Test Merchant',
        dateIso: new Date().toISOString()
      },
      fields: [
        {
          name: '✅ Webhook Status',
          value: 'Your Discord webhook is working correctly!',
          inline: false
        },
        {
          name: '📝 Next Steps',
          value: 'Create alert rules to receive notifications when transactions trigger your configured thresholds.',
          inline: false
        }
      ]
    });

    const success = await sendDiscordWebhook(webhookConfig.webhookUrl, testEmbed);

    if (success) {
      await createAuditLog({
        userId: req.user.id,
        action: 'WEBHOOK_TEST',
        entityType: 'WebhookConfig',
        entityId: webhookConfig.id,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        description: 'Tested Discord webhook - success'
      });

      res.json({ success: true, message: 'Test alert sent successfully! Check your Discord channel.' });
    } else {
      res.status(500).json({ error: 'Failed to send test alert. Check your webhook URL.' });
    }
  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(500).json({ error: 'Failed to send test alert: ' + error.message });
  }
});

// ===== Alert Rules =====

// Get all alert rules
router.get('/alert-rules', requireAuth, async (req, res) => {
  try {
    // Single-user system - NO userId filter
    const rules = await prisma.alertRule.findMany({
      where: {},
      include: {
        category: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ rules });
  } catch (error) {
    console.error('Get alert rules error:', error);
    res.status(500).json({ error: 'Failed to fetch alert rules' });
  }
});

// Get single alert rule
router.get('/alert-rules/:id', requireAuth, async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id);

    const rule = await prisma.alertRule.findUnique({
      where: { id: ruleId },
      include: {
        category: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } }
      }
    });

    // Single-user system - NO userId check
    if (!rule) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    res.json({ rule });
  } catch (error) {
    console.error('Get alert rule error:', error);
    res.status(500).json({ error: 'Failed to fetch alert rule' });
  }
});

// Create alert rule
router.post('/alert-rules', requireAuth, async (req, res) => {
  try {
    const {
      name,
      ruleType,
      threshold,
      currency = 'ILS',
      categoryId,
      categoryIds, // Array of category IDs for multiple categories
      accountId,
      period = 'MONTHLY',
      isEnabled = true
    } = req.body;

    if (!name || !ruleType || threshold === undefined) {
      return res.status(400).json({ error: 'name, ruleType, and threshold are required' });
    }

    if (!['BUDGET_LIMIT', 'LARGE_TRANSACTION', 'MONTHLY_LIMIT', 'ACCOUNT_BALANCE', 'RECURRING_DETECTION'].includes(ruleType)) {
      return res.status(400).json({ error: 'Invalid ruleType' });
    }

    // Handle multiple categories: if categoryIds is provided, use it; otherwise use categoryId
    let finalCategoryId = null;
    let finalCategoryIds = null;
    if (categoryIds && Array.isArray(categoryIds) && categoryIds.length > 0) {
      finalCategoryIds = categoryIds.map(id => parseInt(id));
      // If only one category in array, also set categoryId for backward compatibility
      if (finalCategoryIds.length === 1) {
        finalCategoryId = finalCategoryIds[0];
      }
    } else if (categoryId) {
      finalCategoryId = parseInt(categoryId);
    }

    // Build data object, only include categoryIds if it's not null
    const createData = {
      userId: req.user.id,
      name,
      ruleType,
      threshold: parseFloat(threshold),
      currency,
      categoryId: finalCategoryId,
      accountId: accountId ? parseInt(accountId) : null,
      period,
      isEnabled
    };
    
    // Only add categoryIds if it exists and Prisma client supports it
    if (finalCategoryIds !== null) {
      createData.categoryIds = finalCategoryIds;
    }

    const rule = await prisma.alertRule.create({
      data: createData,
      include: {
        category: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } }
      }
    });

    await createAuditLog({
      userId: req.user.id,
      action: 'CREATE',
      entityType: 'AlertRule',
      entityId: rule.id,
      newValues: {
        name: rule.name,
        ruleType: rule.ruleType,
        threshold: rule.threshold.toString()
      },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      description: `Created alert rule: ${name}`
    });

    res.status(201).json({ success: true, rule });
  } catch (error) {
    console.error('Create alert rule error:', error);
    res.status(500).json({ error: 'Failed to create alert rule' });
  }
});

// Update alert rule
router.put('/alert-rules/:id', requireAuth, async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id);
    const {
      name,
      ruleType,
      threshold,
      currency,
      categoryId,
      categoryIds, // Array of category IDs for multiple categories
      accountId,
      period,
      isEnabled
    } = req.body;

    const existing = await prisma.alertRule.findUnique({
      where: { id: ruleId }
    });

    // Single-user system - NO userId check
    if (!existing) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (ruleType !== undefined) updateData.ruleType = ruleType;
    if (threshold !== undefined) updateData.threshold = parseFloat(threshold);
    if (currency !== undefined) updateData.currency = currency;
    
    // Handle multiple categories: if categoryIds is provided, use it; otherwise use categoryId
    if (categoryIds !== undefined) {
      if (Array.isArray(categoryIds) && categoryIds.length > 0) {
        updateData.categoryIds = categoryIds.map(id => parseInt(id));
        // If only one category in array, also set categoryId for backward compatibility
        if (updateData.categoryIds.length === 1) {
          updateData.categoryId = updateData.categoryIds[0];
        } else {
          updateData.categoryId = null; // Clear single categoryId when using multiple
        }
      } else {
        updateData.categoryIds = null;
        updateData.categoryId = null;
      }
    } else if (categoryId !== undefined) {
      updateData.categoryId = categoryId ? parseInt(categoryId) : null;
      // If setting single category, clear categoryIds
      if (updateData.categoryId) {
        updateData.categoryIds = null;
      }
    }
    
    if (accountId !== undefined) updateData.accountId = accountId ? parseInt(accountId) : null;
    if (period !== undefined) updateData.period = period;
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled;

    const rule = await prisma.alertRule.update({
      where: { id: ruleId },
      data: updateData,
      include: {
        category: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } }
      }
    });

    await createAuditLog({
      userId: req.user.id,
      action: 'UPDATE',
      entityType: 'AlertRule',
      entityId: rule.id,
      newValues: updateData,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      description: `Updated alert rule: ${rule.name}`
    });

    res.json({ success: true, rule });
  } catch (error) {
    console.error('Update alert rule error:', error);
    res.status(500).json({ error: 'Failed to update alert rule' });
  }
});

// Delete alert rule
router.delete('/alert-rules/:id', requireAuth, async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id);

    const existing = await prisma.alertRule.findUnique({
      where: { id: ruleId }
    });

    // Single-user system - NO userId check
    if (!existing) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    await prisma.alertRule.delete({
      where: { id: ruleId }
    });

    await createAuditLog({
      userId: req.user.id,
      action: 'DELETE',
      entityType: 'AlertRule',
      entityId: ruleId,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      description: `Deleted alert rule: ${existing.name}`
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete alert rule error:', error);
    res.status(500).json({ error: 'Failed to delete alert rule' });
  }
});

// Get current user profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        canAccessWeb: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { username, email, currentPassword, newPassword } = req.body;

    // Get existing user
    const existing = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate password if changing password
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to change password' });
      }

      const isValidPassword = await bcrypt.compare(currentPassword, existing.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
      }
    }

    // Check if username/email already exists (excluding current user)
    if (username || email) {
      const duplicate = await prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: req.user.id } },
            {
              OR: [
                username ? { username } : {},
                email ? { email } : {}
              ].filter(obj => Object.keys(obj).length > 0)
            }
          ]
        }
      });

      if (duplicate) {
        return res.status(400).json({ error: 'Username or email already exists' });
      }
    }

    // Prepare update data
    const updateData = {};
    const oldValues = {
      username: existing.username,
      email: existing.email
    };

    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (newPassword) {
      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        canAccessWeb: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'UPDATE',
      entityType: 'User',
      entityId: user.id,
      oldValues,
      newValues: {
        username: user.username,
        email: user.email
      },
      ipAddress: req.auditInfo?.ipAddress,
      userAgent: req.auditInfo?.userAgent,
      description: 'User profile updated'
    });

    logger.info('User profile updated', { userId: req.user.id });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get budget status for dashboard
router.get('/budget-status', requireAuth, async (req, res) => {
  try {
    // Get all enabled budget and monthly limit rules
    // Single-user system - NO userId filter
    const rules = await prisma.alertRule.findMany({
      where: {
        isEnabled: true,
        ruleType: { in: ['BUDGET_LIMIT', 'MONTHLY_LIMIT'] }
      },
      include: {
        category: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } }
      }
    });

    const now = new Date();
    const budgetStatuses = [];

    for (const rule of rules) {
      const threshold = parseFloat(rule.threshold);
      const period = rule.period || 'MONTHLY';
      
      // Calculate period start
      let periodStart;
      switch (period) {
        case 'DAILY':
          periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'WEEKLY':
          periodStart = new Date(now);
          periodStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
          break;
        case 'MONTHLY':
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'YEARLY':
          periodStart = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      // Calculate current spending
      // Single-user system - NO userId filter
      const where = {
        type: 'Expense',
        dateIso: { gte: periodStart }
      };

      // Handle multiple categories
      // If rule has categoryIds or categoryId, only match transactions with those categories
      // If rule has no category filter, include ALL expenses (overall budget)
      if (rule.categoryIds && Array.isArray(rule.categoryIds) && rule.categoryIds.length > 0) {
        where.categoryId = { in: rule.categoryIds };
      } else if (rule.categoryId) {
        where.categoryId = rule.categoryId;
      }
      // If neither categoryIds nor categoryId is set, where.categoryId is undefined
      // which means Prisma will include ALL transactions (including those with null categoryId)

      if (rule.accountId) {
        where.accountId = rule.accountId;
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
      
      // Debug logging
      logger.info(`Budget calculation for rule ${rule.id} (${rule.name})`, {
        userId: req.user.id,
        periodStart: periodStart.toISOString(),
        period: period,
        categoryIds: rule.categoryIds,
        categoryId: rule.categoryId,
        accountId: rule.accountId,
        whereClause: where,
        transactionCount: transactions.length,
        regularTransactionCount: regularTransactions.length,
        excludedCount: transactions.length - regularTransactions.length,
        transactions: regularTransactions.map(t => ({
          id: t.id,
          date: t.dateIso,
          amount: t.amount.toString(),
          convertedAmount: t.convertedAmount?.toString(),
          categoryId: t.categoryId,
          categoryName: t.category?.name,
          excludeFromReports: t.category?.excludeFromReports,
          type: t.type,
          accountId: t.accountId
        }))
      });
      
      const currentSpending = regularTransactions.reduce((sum, t) => {
        const amount = parseFloat(t.convertedAmount || t.amount || 0);
        return sum + Math.abs(amount);
      }, 0);
      
      logger.info(`Budget spending calculated`, {
        ruleId: rule.id,
        ruleName: rule.name,
        currentSpending,
        threshold,
        percentage: (currentSpending / threshold) * 100
      });

      const percentage = (currentSpending / threshold) * 100;
      const remaining = Math.max(0, threshold - currentSpending);
      const exceeded = currentSpending > threshold;
      const overBy = exceeded ? currentSpending - threshold : 0;

      // Get category names for display
      let categoryNames = [];
      if (rule.categoryIds && Array.isArray(rule.categoryIds) && rule.categoryIds.length > 0) {
        const categories = await prisma.category.findMany({
          where: { id: { in: rule.categoryIds } },
          select: { name: true }
        });
        categoryNames = categories.map(c => c.name);
      } else if (rule.category) {
        categoryNames = [rule.category.name];
      }

      budgetStatuses.push({
        id: rule.id,
        name: rule.name,
        ruleType: rule.ruleType,
        threshold: threshold,
        currency: rule.currency || 'ILS',
        currentSpending: currentSpending,
        remaining: remaining,
        percentage: percentage,
        exceeded: exceeded,
        overBy: overBy,
        period: period,
        categoryNames: categoryNames,
        accountName: rule.account?.name || null,
        status: percentage >= 100 ? 'exceeded' : (percentage >= 90 ? 'warning' : 'ok')
      });
    }

    res.json({
      success: true,
      budgets: budgetStatuses
    });
  } catch (error) {
    console.error('Get budget status error:', error);
    logger.error('Get budget status error', { error: error.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch budget status' });
  }
});

module.exports = router;


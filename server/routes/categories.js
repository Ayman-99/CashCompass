const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/access');
const { createAuditLog } = require('../lib/audit');
const logger = require('../lib/logger');
const cache = require('../lib/cache');

const router = express.Router();

// Get all categories (single-user system) - with caching
router.get('/', requireAuth, async (req, res) => {
  try {
    const { type, attr } = req.query;
    
    // Create cache key based on query params
    const cacheKey = `categories_${type || 'all'}_${attr || 'full'}`;
    
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      logger.debug('Categories cache hit', { cacheKey });
      return res.json(cached);
    }
    
    const where = {};
    // Filter by type if provided (Income or Expense)
    if (type && ['Income', 'Expense'].includes(type)) {
      where.type = type;
    }

    const categories = await prisma.category.findMany({
      where,
      orderBy: [
        { type: 'asc' },
        { name: 'asc' }
      ]
    });
    
    let response;
    // If attr=name, return category names as object { "All": "All", "Name": "Name", ... }
    if (attr === 'name') {
      const namesObject = { "All": "All" }; // Always include "All" as first option
      categories.forEach(category => {
        namesObject[category.name] = category.name;
      });
      response = namesObject;
    } else {
      response = { categories };
    }
    
    // Cache for 5 minutes
    cache.set(cacheKey, response, 5 * 60 * 1000);
    
    res.json(response);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Find duplicate categories (same name and type, different IDs)
// MUST come before /:id route to avoid route conflict
router.get('/duplicates', requireAuth, async (req, res) => {
  try {
    // Get all categories grouped by name and type (single-user system, no userId filter)
    const categories = await prisma.category.findMany({
      orderBy: [
        { type: 'asc' },
        { name: 'asc' },
        { id: 'asc' }
      ]
    });

    // Group by name + type + subcategory
    const grouped = {};
    categories.forEach(cat => {
      const key = `${cat.name}|${cat.type}|${cat.subcategory || ''}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(cat);
    });

    // Find duplicates (groups with more than 1 category)
    const duplicates = [];
    Object.values(grouped).forEach(group => {
      if (group.length > 1) {
        duplicates.push({
          name: group[0].name,
          type: group[0].type,
          subcategory: group[0].subcategory,
          categories: group,
          transactionCount: 0 // Will be calculated
        });
      }
    });

    // Count transactions for each duplicate group (single-user system, no userId filter)
    for (const dup of duplicates) {
      const categoryIds = dup.categories.map(c => c.id);
      const count = await prisma.transaction.count({
        where: {
          categoryId: { in: categoryIds }
        }
      });
      dup.transactionCount = count;
    }

    res.json({
      success: true,
      duplicates: duplicates.sort((a, b) => b.transactionCount - a.transactionCount)
    });
  } catch (error) {
    console.error('Find duplicates error:', error);
    logger.error('Find duplicates error', { error: error.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to find duplicate categories' });
  }
});

// Get single category
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    
    // Validate ID
    if (isNaN(categoryId)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }

    // Return category regardless of userId (single-user system)
    const category = await prisma.category.findUnique({
      where: {
        id: categoryId
      }
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ category });
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// Clear categories cache when categories are modified
function clearCategoriesCache() {
  const keys = ['categories_all_full', 'categories_all_name', 'categories_Income_full', 'categories_Income_name', 'categories_Expense_full', 'categories_Expense_name'];
  keys.forEach(key => cache.delete(key));
}

// Create new category
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, type, subcategory, excludeFromReports } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Category name and type required' });
    }

    if (!['Income', 'Expense'].includes(type)) {
      return res.status(400).json({ error: 'Type must be Income or Expense' });
    }

    // Check if category already exists (single-user system)
    const existing = await prisma.category.findFirst({
      where: {
        name,
        type,
        subcategory: subcategory || null
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Category already exists' });
    }

    const category = await prisma.category.create({
      data: {
        userId: req.user.id,
        name,
        type,
        subcategory: subcategory || null,
        excludeFromReports: excludeFromReports === true || excludeFromReports === 'true'
      }
    });

    // Clear cache
    clearCategoriesCache();

    // Audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'CREATE',
      entityType: 'Category',
      entityId: category.id,
      newValues: { name, type, subcategory: subcategory || null },
      ipAddress: req.auditInfo?.ipAddress,
      userAgent: req.auditInfo?.userAgent,
      description: `Category created: ${name} (${type})`
    });

    logger.info(`Category created: ${name}`, { userId: req.user.id, categoryId: category.id });

    res.status(201).json({
      success: true,
      category
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Update category
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { name, type, subcategory, excludeFromReports } = req.body;

    // Get category (single-user system, no userId check)
    const existing = await prisma.category.findUnique({
      where: {
        id: parseInt(req.params.id)
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) {
      if (!['Income', 'Expense'].includes(type)) {
        return res.status(400).json({ error: 'Type must be Income or Expense' });
      }
      updateData.type = type;
    }
    if (subcategory !== undefined) updateData.subcategory = subcategory || null;
    if (excludeFromReports !== undefined) {
      updateData.excludeFromReports = excludeFromReports === true || excludeFromReports === 'true';
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Get old values for audit
    const oldValues = {
      name: existing.name,
      type: existing.type,
      subcategory: existing.subcategory,
      excludeFromReports: existing.excludeFromReports
    };

    const category = await prisma.category.update({
      where: { id: parseInt(req.params.id) },
      data: updateData
    });

    // Audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'UPDATE',
      entityType: 'Category',
      entityId: category.id,
      oldValues,
      newValues: {
        name: category.name,
        type: category.type,
        subcategory: category.subcategory,
        excludeFromReports: category.excludeFromReports
      },
      ipAddress: req.auditInfo?.ipAddress,
      userAgent: req.auditInfo?.userAgent,
      description: `Category updated: ${category.name}`
    });

    // Clear cache after update
    clearCategoriesCache();

    logger.info(`Category updated: ${category.name}`, { userId: req.user.id, categoryId: category.id, excludeFromReports: category.excludeFromReports });

    res.json({
      success: true,
      category
    });
  } catch (error) {
    console.error('Update category error:', error);
    logger.error('Update category error', { 
      error: error.message, 
      stack: error.stack,
      categoryId: req.params.id,
      body: req.body
    });
    
    // Check if error is about missing column
    if (error.message && error.message.includes('exclude_from_reports')) {
      return res.status(500).json({ 
        error: 'Database column missing. Please run: npx prisma db push && npx prisma generate',
        details: error.message
      });
    }
    
    res.status(500).json({ error: 'Failed to update category', details: error.message });
  }
});

// Delete category
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    // Get category (single-user system, no userId check)
    const category = await prisma.category.findUnique({
      where: {
        id: parseInt(req.params.id)
      }
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Get category info before deletion for audit
    const categoryInfo = {
      name: category.name,
      type: category.type,
      subcategory: category.subcategory
    };

    await prisma.category.delete({
      where: { id: parseInt(req.params.id) }
    });

    // Clear cache
    clearCategoriesCache();

    // Audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'DELETE',
      entityType: 'Category',
      entityId: parseInt(req.params.id),
      oldValues: categoryInfo,
      ipAddress: req.auditInfo?.ipAddress,
      userAgent: req.auditInfo?.userAgent,
      description: `Category deleted: ${categoryInfo.name}`
    });

    logger.info(`Category deleted: ${categoryInfo.name}`, { userId: req.user.id, categoryId: parseInt(req.params.id) });

    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// Merge duplicate categories
router.post('/merge', requireAuth, async (req, res) => {
  try {
    const { keepCategoryId, mergeCategoryIds } = req.body;

    if (!keepCategoryId || !Array.isArray(mergeCategoryIds) || mergeCategoryIds.length === 0) {
      return res.status(400).json({ error: 'keepCategoryId and mergeCategoryIds array required' });
    }

    // Get the category to keep
    const keepCategory = await prisma.category.findUnique({
      where: { id: parseInt(keepCategoryId) }
    });

    if (!keepCategory) {
      return res.status(404).json({ error: 'Category to keep not found' });
    }

    // Verify merge categories exist and are different from keep category
    const mergeIds = mergeCategoryIds.map(id => parseInt(id)).filter(id => id !== parseInt(keepCategoryId));
    
    if (mergeIds.length === 0) {
      return res.status(400).json({ error: 'No valid categories to merge' });
    }

    const mergeCategories = await prisma.category.findMany({
      where: { id: { in: mergeIds } }
    });

    if (mergeCategories.length !== mergeIds.length) {
      return res.status(404).json({ error: 'Some categories to merge not found' });
    }

    // Verify they have the same name, type, and subcategory
    for (const cat of mergeCategories) {
      if (cat.name !== keepCategory.name || cat.type !== keepCategory.type || cat.subcategory !== keepCategory.subcategory) {
        return res.status(400).json({ 
          error: `Category "${cat.name}" (ID: ${cat.id}) doesn't match "${keepCategory.name}" - cannot merge different categories` 
        });
      }
    }

    // Count transactions that will be updated
    const transactionCount = await prisma.transaction.count({
      where: {
        categoryId: { in: mergeIds }
      }
    });

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Update all transactions to use the keep category
      await tx.transaction.updateMany({
        where: {
          categoryId: { in: mergeIds }
        },
        data: {
          categoryId: parseInt(keepCategoryId)
        }
      });

      // Update alert rules that reference merged categories
      const alertRules = await tx.alertRule.findMany({
        where: {
          OR: [
            { categoryId: { in: mergeIds } },
            // Also check categoryIds JSON field
          ]
        }
      });

      for (const rule of alertRules) {
        let updated = false;
        const updateData = {};

        // Update categoryId if it matches
        if (rule.categoryId && mergeIds.includes(rule.categoryId)) {
          updateData.categoryId = parseInt(keepCategoryId);
          updated = true;
        }

        // Update categoryIds array if it contains any merged IDs
        if (rule.categoryIds && Array.isArray(rule.categoryIds)) {
          const newCategoryIds = rule.categoryIds
            .map(id => mergeIds.includes(id) ? parseInt(keepCategoryId) : id)
            .filter((id, index, arr) => arr.indexOf(id) === index); // Remove duplicates
          
          if (JSON.stringify(newCategoryIds) !== JSON.stringify(rule.categoryIds)) {
            updateData.categoryIds = newCategoryIds;
            updated = true;
          }
        }

        if (updated) {
          await tx.alertRule.update({
            where: { id: rule.id },
            data: updateData
          });
        }
      }

      // Delete the merged categories
      await tx.category.deleteMany({
        where: {
          id: { in: mergeIds }
        }
      });

      return {
        transactionsUpdated: transactionCount,
        categoriesDeleted: mergeCategories.length,
        alertRulesUpdated: alertRules.length
      };
    });

    // Clear cache
    clearCategoriesCache();

    // Audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'MERGE',
      entityType: 'Category',
      entityId: parseInt(keepCategoryId),
      oldValues: {
        mergedCategories: mergeCategories.map(c => ({ id: c.id, name: c.name }))
      },
      newValues: {
        keptCategory: { id: keepCategory.id, name: keepCategory.name }
      },
      ipAddress: req.auditInfo?.ipAddress,
      userAgent: req.auditInfo?.userAgent,
      description: `Merged ${mergeCategories.length} duplicate categories into "${keepCategory.name}" (${keepCategory.type}). Updated ${result.transactionsUpdated} transactions and ${result.alertRulesUpdated} alert rules.`
    });

    logger.info(`Categories merged`, {
      userId: req.user.id,
      keptCategoryId: keepCategory.id,
      mergedCategoryIds: mergeIds,
      transactionsUpdated: result.transactionsUpdated
    });

    res.json({
      success: true,
      message: `Successfully merged ${mergeCategories.length} duplicate categories`,
      result
    });
  } catch (error) {
    console.error('Merge categories error:', error);
    logger.error('Merge categories error', { error: error.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to merge categories: ' + error.message });
  }
});

module.exports = router;


const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/access');

const router = express.Router();

// Get audit logs
router.get('/', requireAuth, async (req, res) => {
  try {
    const {
      action,
      entityType,
      entityId,
      startDate,
      endDate,
      limit = 100,
      offset = 0
    } = req.query;

    // Return all audit logs (single-user system)
    const where = {};

    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = parseInt(entityId);
    if (startDate) {
      where.createdAt = { gte: new Date(startDate) };
    }
    if (endDate) {
      where.createdAt = {
        ...where.createdAt,
        lte: new Date(endDate)
      };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.auditLog.count({ where })
    ]);

    // Parse JSON strings (safely handle invalid JSON)
    const formattedLogs = logs.map(log => {
      let oldValues = null;
      let newValues = null;
      
      try {
        oldValues = log.oldValues ? JSON.parse(log.oldValues) : null;
      } catch (e) {
        oldValues = log.oldValues; // Return as string if not valid JSON
      }
      
      try {
        newValues = log.newValues ? JSON.parse(log.newValues) : null;
      } catch (e) {
        newValues = log.newValues; // Return as string if not valid JSON
      }
      
      return {
        ...log,
        oldValues,
        newValues
      };
    });

    res.json({
      logs: formattedLogs,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get audit log by ID
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const log = await prisma.auditLog.findFirst({
      where: {
        id: parseInt(req.params.id),
        userId: req.user.id
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    if (!log) {
      return res.status(404).json({ error: 'Audit log not found' });
    }

    let oldValues = null;
    let newValues = null;
    
    try {
      oldValues = log.oldValues ? JSON.parse(log.oldValues) : null;
    } catch (e) {
      oldValues = log.oldValues;
    }
    
    try {
      newValues = log.newValues ? JSON.parse(log.newValues) : null;
    } catch (e) {
      newValues = log.newValues;
    }

    res.json({
      log: {
        ...log,
        oldValues,
        newValues
      }
    });
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// Get audit logs for specific entity
router.get('/entity/:entityType/:entityId', requireAuth, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;

    const logs = await prisma.auditLog.findMany({
      where: {
        userId: req.user.id,
        entityType,
        entityId: parseInt(entityId)
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedLogs = logs.map(log => {
      let oldValues = null;
      let newValues = null;
      
      try {
        oldValues = log.oldValues ? JSON.parse(log.oldValues) : null;
      } catch (e) {
        oldValues = log.oldValues;
      }
      
      try {
        newValues = log.newValues ? JSON.parse(log.newValues) : null;
      } catch (e) {
        newValues = log.newValues;
      }
      
      return {
        ...log,
        oldValues,
        newValues
      };
    });

    res.json({ logs: formattedLogs });
  } catch (error) {
    console.error('Get entity audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Delete all audit logs (clear audit trail)
router.delete('/', requireAuth, async (req, res) => {
  try {
    const deletedCount = await prisma.auditLog.deleteMany({});
    
    res.json({
      success: true,
      message: `Successfully deleted ${deletedCount.count} audit log(s)`,
      deletedCount: deletedCount.count
    });
  } catch (error) {
    console.error('Delete audit logs error:', error);
    res.status(500).json({ error: 'Failed to delete audit logs' });
  }
});

module.exports = router;


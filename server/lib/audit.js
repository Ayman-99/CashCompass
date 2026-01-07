const prisma = require('./prisma');
const logger = require('./logger');

/**
 * Create audit log entry
 * @param {Object} params
 * @param {number} params.userId - User ID
 * @param {string} params.action - Action type (CREATE, UPDATE, DELETE, LOGIN, etc.)
 * @param {string} params.entityType - Entity type (Account, Category, Transaction, User)
 * @param {number} params.entityId - Entity ID (optional)
 * @param {Object} params.oldValues - Old values before change (optional)
 * @param {Object} params.newValues - New values after change (optional)
 * @param {string} params.ipAddress - IP address (optional)
 * @param {string} params.userAgent - User agent (optional)
 * @param {string} params.description - Description (optional)
 */
async function createAuditLog({
  userId,
  action,
  entityType,
  entityId = null,
  oldValues = null,
  newValues = null,
  ipAddress = null,
  userAgent = null,
  description = null
}) {
  try {
    const auditLog = await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        oldValues: oldValues ? JSON.stringify(oldValues) : null,
        newValues: newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent,
        description
      }
    });

    // Also log to file
    logger.audit(action, {
      userId,
      entityType,
      entityId,
      description: description || `${action} ${entityType}${entityId ? ` #${entityId}` : ''}`
    });

    return auditLog;
  } catch (error) {
    logger.error('Failed to create audit log', { error: error.message, stack: error.stack });
    // Don't throw - audit logging shouldn't break the main flow
    return null;
  }
}

/**
 * Get client IP address from request
 * When behind nginx proxy, X-Forwarded-For contains the real client IP
 */
function getClientIp(req) {
  // Priority: X-Forwarded-For (first IP) > X-Real-IP > req.ip > connection IP
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }
  
  if (req.headers['x-real-ip']) {
    return req.headers['x-real-ip'].trim();
  }
  
  return req.ip ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         null;
}

/**
 * Get user agent from request
 */
function getUserAgent(req) {
  return req.headers['user-agent'] || null;
}

/**
 * Middleware to extract request info for audit logs
 */
function auditMiddleware(req, res, next) {
  req.auditInfo = {
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req)
  };
  next();
}

module.exports = {
  createAuditLog,
  getClientIp,
  getUserAgent,
  auditMiddleware
};


const { createAuditLog } = require('../lib/audit');
const { getClientIp } = require('../lib/audit');
const logger = require('../lib/logger');

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Important endpoints that should always be logged (even in production)
 */
const IMPORTANT_ENDPOINTS = [
  '/api/auth/login',
  '/api/auth/web-login',
  '/api/auth/register',
  '/api/transactions',
  '/api/transactions/transfer',
  '/api/accounts',
  '/api/categories',
  '/api/currencies',
  '/api/admin'
];

/**
 * Endpoints to skip logging (static files, health checks, etc.)
 */
const SKIP_ENDPOINTS = [
  '/',
  '/dashboard.html',
  '/login.html',
  '/admin.html',
  '/audit.html',
  '/favicon.ico'
];

/**
 * Check if endpoint should be logged
 */
function shouldLogRequest(path, method) {
  // Skip static files and non-API routes
  if (SKIP_ENDPOINTS.includes(path)) return false;
  if (!path.startsWith('/api/')) return false;
  
  // In development, log all API requests
  if (isDevelopment) return true;
  
  // In production, only log important endpoints
  return IMPORTANT_ENDPOINTS.some(endpoint => path.startsWith(endpoint));
}

/**
 * Get user ID from request (session or token)
 */
async function getUserIdFromRequest(req) {
  // Check for web session
  if (req.session && req.session.userId) {
    return req.session.userId;
  }
  
  // Check for API token
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      return decoded.userId;
    } catch (error) {
      return null; // Invalid token
    }
  }
  
  return null;
}

/**
 * Middleware to log API requests to audit trail
 */
function requestLoggerMiddleware(req, res, next) {
  // Always log when middleware is called for API requests (for debugging)
  if (req.path.startsWith('/api/')) {
    console.log(`[RequestLogger] ${req.method} ${req.path} - shouldLog: ${shouldLogRequest(req.path, req.method)}, NODE_ENV: ${process.env.NODE_ENV}`);
    logger.info(`[RequestLogger] ${req.method} ${req.path}`, {
      path: req.path,
      method: req.method,
      shouldLog: shouldLogRequest(req.path, req.method),
      isDevelopment,
      NODE_ENV: process.env.NODE_ENV
    });
  }
  
  // Skip if shouldn't log
  if (!shouldLogRequest(req.path, req.method)) {
    console.log(`[RequestLogger] Skipping ${req.method} ${req.path} - not configured to log`);
    return next();
  }
  
  console.log(`[RequestLogger] Will log ${req.method} ${req.path}`);
  logger.info(`[RequestLogger] Will log ${req.method} ${req.path}`);

  // Store original functions
  const originalEnd = res.end;
  const originalJson = res.json;
  const originalSend = res.send;
  const startTime = Date.now();
  let responseSent = false;

  // Helper function to log the request
  const logRequest = function() {
    if (responseSent) return; // Prevent double logging
    responseSent = true;
    
    const requestDuration = Date.now() - startTime;
    const requestStatusCode = res.statusCode;
    
    logger.debug(`Response for ${req.method} ${req.path}: ${requestStatusCode} (${requestDuration}ms)`, {
      hasReqUser: !!req.user,
      reqUserId: req.user?.id,
      hasSession: !!req.session,
      sessionUserId: req.session?.userId
    });
    
    // Log request asynchronously (don't block response)
    setImmediate(async () => {
      try {
        // Get user ID (check req.user first, then session, then token, then fallback to admin)
        let finalUserId = null;
        
        // Check req.user (set by authentication middleware)
        if (req.user && req.user.id) {
          finalUserId = req.user.id;
          logger.debug(`Using req.user.id: ${finalUserId}`);
        }
        // Check session
        else if (req.session && req.session.userId) {
          finalUserId = req.session.userId;
          logger.debug(`Using req.session.userId: ${finalUserId}`);
        }
        // Try to get from token
        else {
          const userId = await getUserIdFromRequest(req);
          if (userId) {
            finalUserId = userId;
            logger.debug(`Using token userId: ${finalUserId}`);
          }
        }
        
        // If still no user ID, try to get admin user as fallback
        if (!finalUserId) {
          try {
            const prisma = require('../lib/prisma');
            const adminUser = await prisma.user.findFirst({
              where: { username: 'admin' },
              select: { id: true }
            });
            finalUserId = adminUser?.id || 1; // Use admin ID or default to 1
            logger.debug(`Using admin fallback userId: ${finalUserId}`);
          } catch (error) {
            // If we can't get admin user, skip logging
            logger.warn('Cannot log request - no user ID available', {
              path: req.path,
              method: req.method,
              error: error.message
            });
            return;
          }
        }
        
        if (!finalUserId) {
          logger.error('No user ID found for audit log', {
            path: req.path,
            method: req.method
          });
          return;
        }
        
        // Determine action based on method and status
        let action = 'API_REQUEST';
        if (req.method === 'GET') action = 'API_GET';
        else if (req.method === 'POST') action = 'API_POST';
        else if (req.method === 'PUT') action = 'API_PUT';
        else if (req.method === 'DELETE') action = 'API_DELETE';
        
        // Only log 500+ errors as API_ERROR (server errors)
        // 400-499 are client errors (expected responses) - don't log as errors
        const isServerError = requestStatusCode >= 500;
        const isClientError = requestStatusCode >= 400 && requestStatusCode < 500;
        
        if (isServerError) {
          action = 'API_ERROR';
        } else if (isClientError) {
          // Keep the original action for client errors (they're expected responses)
          // Don't change to API_ERROR_CLIENT unless we want to track them separately
        }
        
        // Create description
        let description = `${req.method} ${req.path}`;
        if (isServerError) {
          description += ` - Server Error ${requestStatusCode}`;
        } else if (isClientError) {
          description += ` - Client Error ${requestStatusCode}`;
        } else {
          description += ` - Success (${requestDuration}ms)`;
        }
        
        // Endpoints that commonly return 400 (expected client errors) - don't log as errors
        const expectedClientErrorEndpoints = [
          '/api/currencies/exchange', // Returns 400 when rate not found (expected)
          '/api/auth/web-login',      // Returns 400/401 for invalid credentials (expected)
          '/api/auth/api-login',      // Returns 400/401 for invalid credentials (expected)
          '/'                          // POST to root returns 400 (expected - wrong endpoint)
        ];
        
        const isExpectedClientError = isClientError && 
          expectedClientErrorEndpoints.some(endpoint => req.path.startsWith(endpoint));
        
        // Only log in development or if it's an important endpoint or server error
        // Don't log expected client errors (400s from known endpoints)
        const isImportant = IMPORTANT_ENDPOINTS.some(endpoint => req.path.startsWith(endpoint));
        const shouldLogError = isServerError || (isClientError && !isExpectedClientError);
        
        logger.debug(`Checking if should log: ${req.method} ${req.path}`, {
          isDevelopment,
          isImportant,
          isServerError,
          isClientError,
          isExpectedClientError,
          statusCode: requestStatusCode,
          willLog: (isDevelopment || isImportant || shouldLogError)
        });
        
        if (isDevelopment || isImportant || shouldLogError) {
          logger.info(`Creating audit log for ${req.method} ${req.path}`, {
            userId: finalUserId,
            statusCode: requestStatusCode,
            action
          });
          
          const auditLog = await createAuditLog({
            userId: finalUserId,
            action,
            entityType: 'API',
            entityId: null,
            oldValues: null,
            newValues: {
              method: req.method,
              path: req.path,
              statusCode: requestStatusCode,
              duration: `${requestDuration}ms`,
              query: Object.keys(req.query).length > 0 ? req.query : null,
              hasBody: !!req.body && Object.keys(req.body).length > 0
            },
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'],
            description
          });
          
          // Debug log
          if (auditLog) {
            logger.info(`✅ Audit log created for ${req.method} ${req.path}`, {
              userId: finalUserId,
              statusCode: requestStatusCode,
              action,
              auditLogId: auditLog.id
            });
          } else {
            logger.error(`❌ Failed to create audit log for ${req.method} ${req.path}`, {
              userId: finalUserId,
              statusCode: requestStatusCode,
              action
            });
          }
        } else {
          // Debug: log why request wasn't logged
          logger.debug(`Request not logged: ${req.method} ${req.path}`, {
            isDevelopment,
            isImportant,
            isError,
            statusCode: requestStatusCode,
            reason: 'Not in development, not important endpoint, and not an error'
          });
        }
      } catch (error) {
        // Don't let audit logging break the request
        logger.error('Failed to log request to audit trail', { 
          error: error.message,
          stack: error.stack,
          path: req.path,
          method: req.method
        });
      }
    });
  };

  // Override res.end
  res.end = function(chunk, encoding) {
    logRequest(chunk, encoding);
    originalEnd.call(this, chunk, encoding);
  };

  // Override res.json (commonly used in Express)
  res.json = function(body) {
    logRequest(JSON.stringify(body), 'utf8');
    return originalJson.call(this, body);
  };

  // Override res.send (also commonly used)
  res.send = function(body) {
    logRequest(body, 'utf8');
    return originalSend.call(this, body);
  };
  
  next();
}

/**
 * Error logging middleware - logs errors to audit trail
 */
function errorLoggerMiddleware(err, req, res, next) {
  // Log error to file
  logger.error(`Error in ${req.method} ${req.path}`, {
    error: err.message,
    stack: err.stack,
    ip: getClientIp(req),
    userAgent: req.headers['user-agent']
  });

  // Log to audit trail asynchronously
  setImmediate(async () => {
    try {
      let logUserId = await getUserIdFromRequest(req);
      if (!logUserId) {
        // Try to get admin user ID as fallback
        try {
          const prisma = require('../lib/prisma');
          const adminUser = await prisma.user.findFirst({
            where: { username: 'admin' },
            select: { id: true }
          });
          logUserId = adminUser?.id || 1;
        } catch (error) {
          // Skip logging if we can't get a user ID
          return;
        }
      }
      
      await createAuditLog({
        userId: logUserId,
        action: 'API_ERROR',
        entityType: 'Error',
        entityId: null,
        oldValues: null,
        newValues: {
          method: req.method,
          path: req.path,
          error: err.message,
          statusCode: err.statusCode || 500,
          stack: isDevelopment ? err.stack : null // Only include stack in development
        },
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        description: `Error in ${req.method} ${req.path}: ${err.message}`
      });
    } catch (auditError) {
      // Don't let audit logging break error handling
      logger.error('Failed to log error to audit trail', { error: auditError.message });
    }
  });

  // Send error response
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
    ...(isDevelopment && { stack: err.stack }) // Only include stack in development
  });
}

module.exports = {
  requestLoggerMiddleware,
  errorLoggerMiddleware
};


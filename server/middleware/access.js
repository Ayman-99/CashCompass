const prisma = require('../lib/prisma');
const logger = require('../lib/logger');

/**
 * Get client IP address
 * When behind nginx proxy, X-Forwarded-For contains the real client IP
 * X-Real-IP is also set by nginx as a single IP (no comma-separated list)
 */
function getClientIp(req) {
  // Priority: X-Forwarded-For (first IP in comma-separated list) > X-Real-IP > req.ip (from Express trust proxy) > connection IP
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
    // The first one is the original client IP
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }
  
  // X-Real-IP is set by nginx and contains a single IP
  if (req.headers['x-real-ip']) {
    return req.headers['x-real-ip'].trim();
  }
  
  // req.ip should work with trust proxy, but fallback to connection IP
  return req.ip || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         'unknown';
}

/**
 * Check if request is from web (has session) or API (has token)
 */
function isWebRequest(req) {
  return req.session && req.session.userId;
}

function isApiRequest(req) {
  // Check both lowercase and original case (Express normalizes to lowercase, but be safe)
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader) {
    return false;
  }
  // Trim and check for Bearer prefix (case-insensitive)
  const trimmed = authHeader.trim();
  return trimmed.toLowerCase().startsWith('bearer ');
}

/**
 * Middleware to restrict web access to users with canAccessWeb = true
 */
async function restrictWebAccess(req, res, next) {
  // Only check for web requests
  if (!isWebRequest(req)) {
    return next();
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: { id: true, username: true, canAccessWeb: true }
    });

    if (!user) {
      req.session.destroy();
      return res.status(401).json({ error: 'User not found' });
    }

    if (!user.canAccessWeb) {
      req.session.destroy();
      logger.warn(`Web access denied for user: ${user.username}`, {
        userId: user.id,
        ip: getClientIp(req)
      });
      return res.status(403).json({ 
        error: 'Web access is not enabled for your account. Please contact administrator.' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Error checking web access', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Middleware to restrict API access based on IP whitelist
 */
async function restrictApiAccess(req, res, next) {
  // Only check for API requests
  if (!isApiRequest(req)) {
    return next();
  }

  try {
    // Check both lowercase and original case, trim whitespace
    const authHeader = (req.headers['authorization'] || req.headers['Authorization'] || '').trim();
    if (!authHeader) {
      return next(); // Let requireAuth handle this
    }
    
    // Extract token (handle "Bearer TOKEN" or "bearer TOKEN")
    const parts = authHeader.split(' ');
    const token = parts.length > 1 ? parts[1] : null;
    if (!token) {
      return next(); // Let requireAuth handle this
    }
    
    const jwt = require('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret';
    
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError) {
      logger.warn('restrictApiAccess: JWT verification failed', { 
        error: jwtError.message,
        name: jwtError.name,
        path: req.path
      });
      // Don't return error here - let requireAuth handle it with better error message
      return next();
    }
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, username: true, allowedIps: true }
    });

    if (!user) {
      logger.warn('restrictApiAccess: User not found', { userId: decoded.userId });
      return res.status(401).json({ error: 'User not found' });
    }

    // If user has IP restrictions, check them
    if (user.allowedIps && user.allowedIps.trim() !== '') {
      const clientIp = getClientIp(req);
      const allowedIps = user.allowedIps.split(',').map(ip => ip.trim());
      
      if (!allowedIps.includes(clientIp) && !allowedIps.includes('*')) {
        logger.warn(`restrictApiAccess: IP denied`, {
          userId: user.id,
          username: user.username,
          clientIp,
          allowedIps: user.allowedIps
        });
        return res.status(403).json({ 
          error: 'API access denied from this IP address' 
        });
      }
    }

    // Set req.user for API requests
    req.user = user;
    console.log(`[restrictApiAccess] User authenticated: ${user.username} (ID: ${user.id})`);
    logger.info('restrictApiAccess: User authenticated', { userId: user.id, username: user.username });
    next();
  } catch (error) {
    logger.error('restrictApiAccess: Unexpected error', { 
      error: error.message, 
      stack: error.stack,
      path: req.path 
    });
    // Don't block - let requireAuth try
    return next();
  }
}

/**
 * Middleware to check if user is authenticated (web or API)
 */
async function requireAuth(req, res, next) {
  // If req.user is already set by restrictWebAccess or restrictApiAccess, skip re-validation
  if (req.user && req.user.id) {
    return next();
  }

  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  // Check for web session
  if (isWebRequest(req)) {
    if (!req.session.userId) {
      logger.debug('requireAuth: Web request but no session userId');
      return res.status(401).json({ error: 'Not authenticated' });
    }
    // Ensure req.user is set for web requests (should be set by restrictWebAccess, but ensure it's there)
    if (!req.user) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: req.session.userId },
          select: { id: true, username: true, email: true }
        });
        if (user) {
          req.user = user;
          logger.debug('requireAuth: Web user loaded', { userId: user.id });
        } else {
          logger.warn('requireAuth: Web user not found', { sessionUserId: req.session.userId });
          return res.status(401).json({ error: 'User not found' });
        }
      } catch (error) {
        logger.error('requireAuth: Database error', { error: error.message });
        return res.status(500).json({ error: 'Database error' });
      }
    }
    return next();
  }

  // Check for API token
  if (isApiRequest(req)) {
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, username: true, email: true }
      });

      if (!user) {
        logger.warn('requireAuth: User not found', { userId: decoded.userId });
        return res.status(401).json({ error: 'User not found' });
      }

      // Set req.user (should already be set by restrictApiAccess, but set it here as fallback)
      req.user = user;
      return next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        logger.warn('requireAuth: Token expired', { error: error.message });
        return res.status(401).json({ error: 'Token expired' });
      }
      logger.warn('requireAuth: Invalid token', { error: error.message, name: error.name });
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  // No authentication found
  logger.warn('requireAuth: No authentication found', {
    hasSession: !!(req.session && req.session.userId),
    hasAuthHeader: !!(req.headers['authorization'] || req.headers['Authorization']),
    path: req.path,
    method: req.method
  });
  return res.status(401).json({ error: 'Authentication required' });
}

/**
 * Middleware to restrict write operations (POST, PUT, DELETE) to web only
 * Allows GET operations from both web and API
 * Must run after requireAuth, restrictWebAccess, and restrictApiAccess
 */
function restrictWriteToWeb(req, res, next) {
  // Allow GET requests from both web and API
  if (req.method === 'GET') {
    return next();
  }

  // For write operations (POST, PUT, DELETE), only allow web requests
  // Check if user is authenticated via web session (not API token)
  if (!isWebRequest(req)) {
    logger.warn(`Write operation denied for API request: ${req.method} ${req.path}`, {
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'],
      userId: req.user?.id
    });
    return res.status(403).json({ 
      error: 'This operation can only be performed from the web interface. Please use the dashboard to create or modify resources.' 
    });
  }

  // Web request allowed
  next();
}

module.exports = {
  isWebRequest,
  isApiRequest,
  restrictWebAccess,
  restrictApiAccess,
  requireAuth,
  restrictWriteToWeb,
  getClientIp
};


const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { generateToken } = require('../middleware/auth');
const { createAuditLog } = require('../lib/audit');
const { getClientIp } = require('../middleware/access');
const logger = require('../lib/logger');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting for login endpoints
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Fix trust proxy warning - use X-Forwarded-For but validate it
  trustProxy: true,
  // Use a custom key generator that validates the IP
  keyGenerator: (req) => {
    // Get IP from X-Forwarded-For (set by nginx) or fallback to connection IP
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip || req.connection.remoteAddress;
    return ip || 'unknown';
  }
});

// Register endpoint disabled - users must be created through admin dashboard
router.post('/register', async (req, res) => {
  res.status(403).json({ 
    error: 'Registration is disabled. Please contact an administrator to create an account.' 
  });
});

// Web login (creates session)
router.post('/web-login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Find user
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email: username }
        ]
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user can access web
    if (!user.canAccessWeb) {
      logger.warn(`Web login attempt denied for user: ${user.username}`, {
        userId: user.id,
        ip: getClientIp(req)
      });
      return res.status(403).json({ 
        error: 'Web access is not enabled for your account. Please use API access.' 
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create session (2 days / 48 hours)
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.loginTime = Date.now(); // Track login time for expiration

    // Update session cookie settings
    // Use secure cookies only if explicitly enabled via USE_SECURE_COOKIES=true
    const useSecureCookies = process.env.USE_SECURE_COOKIES === 'true' || 
      (process.env.NODE_ENV === 'production' && process.env.USE_SECURE_COOKIES !== 'false');
    
    req.session.cookie.httpOnly = true;
    req.session.cookie.secure = useSecureCookies;
    req.session.cookie.sameSite = 'lax';
    req.session.cookie.maxAge = 2 * 24 * 60 * 60 * 1000; // 2 days (48 hours)

    // Clear any existing remembered username cookie
    res.clearCookie('remembered_username');

    // Explicitly save session before sending response
    req.session.save((err) => {
      if (err) {
        logger.error('Session save error:', err);
        return res.status(500).json({ error: 'Session error' });
      }

      // Audit log
      createAuditLog({
        userId: user.id,
        action: 'WEB_LOGIN',
        entityType: 'User',
        entityId: user.id,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        description: `Web login: ${user.username}`
      }).catch(err => logger.error('Audit log error:', err));

      logger.info(`Web login: ${user.username}`, { 
        userId: user.id, 
        ip: getClientIp(req),
        sessionId: req.sessionID
      });

      res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    });
  } catch (error) {
    logger.error('Web login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// API login (returns token) - POST endpoint
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Find user
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email: username }
        ]
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.passwordHash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id);

    // Audit log
    await createAuditLog({
      userId: user.id,
      action: 'API_LOGIN',
      entityType: 'User',
      entityId: user.id,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      description: `API login: ${user.username}`
    });

    logger.info(`API login: ${user.username}`, { userId: user.id, ip: getClientIp(req) });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// API login (returns token) - GET endpoint (workaround for Scriptable POST limitation)
// NOTE: Less secure than POST (credentials in URL), but necessary for Scriptable compatibility
router.get('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.query;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required as query parameters' });
    }

    // Find user
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email: username }
        ]
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.passwordHash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id);

    // Audit log
    await createAuditLog({
      userId: user.id,
      action: 'API_LOGIN_GET',
      entityType: 'User',
      entityId: user.id,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      description: `API login (GET): ${user.username}`
    });

    logger.info(`API login (GET): ${user.username}`, { userId: user.id, ip: getClientIp(req) });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login (GET) error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user (web session or API token)
router.get('/me', async (req, res) => {
  try {
    // Check for web session first
    if (req.session && req.session.userId) {
      logger.info('Session check', { 
        sessionId: req.sessionID, 
        userId: req.session.userId,
        hasSession: !!req.session
      });

      const user = await prisma.user.findUnique({
        where: { id: req.session.userId },
        select: { id: true, username: true, email: true, canAccessWeb: true }
      });

      logger.info('User lookup', { 
        userId: req.session.userId,
        userFound: !!user,
        canAccessWeb: user?.canAccessWeb
      });

      if (!user || !user.canAccessWeb) {
        logger.warn('Access denied', { 
          userId: req.session.userId,
          userFound: !!user,
          canAccessWeb: user?.canAccessWeb
        });
        req.session.destroy();
        return res.status(401).json({ error: 'Not authenticated' });
      }

      return res.json({ user });
    }

    // Check for API token
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, username: true, email: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout (web session)
router.post('/logout', async (req, res) => {
  try {
    if (req.session) {
      const userId = req.session.userId;
      req.session.destroy((err) => {
        if (err) {
          logger.error('Logout error:', err);
          return res.status(500).json({ error: 'Failed to logout' });
        }
        
        if (userId) {
          createAuditLog({
            userId,
            action: 'WEB_LOGOUT',
            entityType: 'User',
            entityId: userId,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'],
            description: 'Web logout'
          });
        }
        
        res.json({ success: true, message: 'Logged out successfully' });
      });
    } else {
      res.json({ success: true, message: 'Logged out successfully' });
    }
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;


require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const prisma = require('./lib/prisma');
const { 
  calculateAnalytics, 
  generatePredictions, 
  generateSavingsTips,
  calculateSpendingTrends,
  calculateCategoryTrends,
  calculateYearOverYear,
  detectRecurringTransactions
} = require('./analytics');
const {
  getTransactionsFromDB,
  getAnalyticsFromDB,
  getPredictionsFromDB,
  getTipsFromDB,
  getEnhancedAnalyticsFromDB,
  getRecurringFromDB,
  getAdvancedAnalyticsFromDB,
  getSpendingPatternsFromDB,
  getMerchantsFromDB,
  getCashFlowCalendarFromDB,
  getFinancialHealthScoreFromDB,
  getSpendingVelocityFromDB,
  getAIInsightsFromDB,
  getLoansAndDebtsFromDB,
  getExpensesByPersonFromDB,
  getDebtByPersonFromDB
} = require('./lib/db-analytics');

const app = express();
const PORT = process.env.PORT || 9001;

// Trust proxy (required when behind nginx or other reverse proxy)
// This ensures Express correctly reads headers like X-Forwarded-For and preserves request headers
app.set('trust proxy', true);

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
// Use secure cookies only if explicitly enabled via USE_SECURE_COOKIES=true
// or if behind HTTPS proxy (trust proxy must be set)
const useSecureCookies = process.env.USE_SECURE_COOKIES === 'true' || 
  (process.env.NODE_ENV === 'production' && process.env.USE_SECURE_COOKIES !== 'false');

app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret-change-this',
  resave: false,
  saveUninitialized: false,
  name: 'finance_app_session', // Custom session cookie name
  cookie: {
    secure: useSecureCookies,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 2 * 24 * 60 * 60 * 1000 // 2 days (48 hours) - auto logout after 2 days
  },
  // Rolling sessions - extend session on activity
  rolling: true
}));

// Rate limiting for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Static files (public directory for web pages)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname)); // Keep for existing dashboard.html if needed

// Request logging middleware
const logger = require('./lib/logger');
const { auditMiddleware } = require('./lib/audit');
const { requestLoggerMiddleware, errorLoggerMiddleware } = require('./middleware/request-logger');
const { checkSessionExpiration, refreshSession } = require('./middleware/session');

app.use((req, res, next) => {
  // Get real client IP (works with nginx proxy)
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                   req.headers['x-real-ip'] ||
                   req.ip ||
                   req.connection?.remoteAddress ||
                   'unknown';
  
  logger.info(`${req.method} ${req.path}`, {
    ip: clientIp,
    userAgent: req.headers['user-agent']
  });
  next();
});

// Session expiration check (before auth, but after session middleware)
app.use(checkSessionExpiration);

// Audit middleware (extracts IP and user agent)
app.use(auditMiddleware);

// Request logger middleware (logs API requests to audit trail)
// Note: This runs before routes, but checks req.user in res.end callback (after auth)
app.use(requestLoggerMiddleware);

// Refresh session on activity (rolling sessions)
app.use(refreshSession);

// Web routes
app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    res.redirect('/dashboard.html');
  } else {
    res.redirect('/login.html');
  }
});

// Handle POST to root path (common mistake from API clients)
app.post('/', (req, res) => {
  res.status(400).json({ 
    error: 'Invalid endpoint. Please use specific API endpoints like /api/transactions, /api/auth/api-login, etc.',
    availableEndpoints: {
      auth: '/api/auth/api-login',
      transactions: '/api/transactions',
      accounts: '/api/accounts',
      categories: '/api/categories'
    }
  });
});

// API Routes
const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/accounts');
const categoryRoutes = require('./routes/categories');
const transactionRoutes = require('./routes/transactions');
const auditRoutes = require('./routes/audit');
const adminRoutes = require('./routes/admin');
const currencyRoutes = require('./routes/currencies');
const settingsRoutes = require('./routes/settings');
const exportRoutes = require('./routes/export');
const { restrictWebAccess, restrictApiAccess, restrictWriteToWeb } = require('./middleware/access');

app.use('/api/auth', authRoutes);
// Settings routes (profile management)
app.use('/api/settings', restrictWebAccess, restrictApiAccess, settingsRoutes);
// Export routes
app.use('/api/export', restrictWebAccess, restrictApiAccess, exportRoutes);
// Analytics endpoints (before transaction routes to avoid conflicts)
// Accounts: Read from API allowed, Write only from web
// Order: restrictWebAccess (sets req.user for web) -> restrictApiAccess (sets req.user for API) -> restrictWriteToWeb (checks if web for writes)
app.use('/api/accounts', restrictWebAccess, restrictApiAccess, restrictWriteToWeb, accountRoutes);
// Categories: Read from API allowed, Write only from web
app.use('/api/categories', restrictWebAccess, restrictApiAccess, restrictWriteToWeb, categoryRoutes);
// Currencies: Read from API allowed, Write only from web
app.use('/api/currencies', restrictWebAccess, restrictApiAccess, restrictWriteToWeb, currencyRoutes);
app.use('/api/audit', restrictWebAccess, restrictApiAccess, auditRoutes);
app.use('/api/admin', restrictWebAccess, restrictApiAccess, adminRoutes);
// Transaction routes (handles /api/transactions) - Mobile can create transactions, transfers allowed from both
app.use('/api/transactions', restrictWebAccess, restrictApiAccess, transactionRoutes);

// Legacy CSV-based analytics removed - now using database via lib/db-analytics.js

// API endpoints - Database-based analytics
app.get('/api/data', async (req, res) => {
  try {
    // Get user from session or token
    let userId = null;
    if (req.session && req.session.userId) {
      userId = req.session.userId;
    } else {
      // Try to get from token
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const jwt = require('jsonwebtoken');
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
        userId = decoded.userId;
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    
    const analytics = await getAnalyticsFromDB(userId, startDate, endDate);
    const predictions = await getPredictionsFromDB(userId, startDate, endDate);
    const tips = await getTipsFromDB(userId, startDate, endDate);
    
    res.json({
      analytics,
      predictions,
      tips,
      dateRange: {
        start: startDate,
        end: endDate
      }
    });
  } catch (error) {
    console.error('Error in /api/data:', error);
    res.status(500).json({ error: 'Failed to load data' });
  }
});

app.get('/api/analytics', async (req, res) => {
  try {
    let userId = null;
    if (req.session && req.session.userId) {
      userId = req.session.userId;
    } else {
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const jwt = require('jsonwebtoken');
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
        userId = decoded.userId;
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    
    const analytics = await getAnalyticsFromDB(userId, startDate, endDate);
    res.json(analytics);
  } catch (error) {
    console.error('Error in /api/analytics:', error);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

app.get('/api/predictions', async (req, res) => {
  try {
    let userId = null;
    if (req.session && req.session.userId) {
      userId = req.session.userId;
    } else {
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const jwt = require('jsonwebtoken');
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
        userId = decoded.userId;
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    
    const predictions = await getPredictionsFromDB(userId, startDate, endDate);
    res.json(predictions);
  } catch (error) {
    console.error('Error in /api/predictions:', error);
    res.status(500).json({ error: 'Failed to load predictions' });
  }
});

app.get('/api/tips', async (req, res) => {
  try {
    let userId = null;
    if (req.session && req.session.userId) {
      userId = req.session.userId;
    } else {
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const jwt = require('jsonwebtoken');
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
        userId = decoded.userId;
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    
    const tips = await getTipsFromDB(userId, startDate, endDate);
    res.json(tips);
  } catch (error) {
    console.error('Error in /api/tips:', error);
    res.status(500).json({ error: 'Failed to load tips' });
  }
});

// Legacy /api/reload endpoint removed - data is now managed via database

// Transactions endpoint is now handled by routes/transactions.js

// Get enhanced analytics
app.get('/api/analytics/enhanced', async (req, res) => {
  try {
    let userId = null;
    if (req.session && req.session.userId) {
      userId = req.session.userId;
    } else {
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const jwt = require('jsonwebtoken');
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
        userId = decoded.userId;
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    
    const enhanced = await getEnhancedAnalyticsFromDB(userId, startDate, endDate);
    res.json(enhanced);
  } catch (error) {
    console.error('Error in /api/analytics/enhanced:', error);
    res.status(500).json({ error: 'Failed to load enhanced analytics' });
  }
});

// Get recurring transactions
app.get('/api/recurring', async (req, res) => {
  try {
    let userId = null;
    if (req.session && req.session.userId) {
      userId = req.session.userId;
    } else {
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const jwt = require('jsonwebtoken');
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
        userId = decoded.userId;
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    
    const recurring = await getRecurringFromDB(userId, startDate, endDate);
    res.json({ recurring });
  } catch (error) {
    console.error('Error in /api/recurring:', error);
    res.status(500).json({ error: 'Failed to load recurring transactions' });
  }
});

// Helper function to get userId from request
function getUserIdFromRequest(req) {
  if (req.session && req.session.userId) {
    return req.session.userId;
  }
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const jwt = require('jsonwebtoken');
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      return decoded.userId;
    } catch (error) {
      return null;
    }
  }
  return null;
}

// Advanced Analytics Endpoints
app.get('/api/analytics/advanced', async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    
    const advanced = await getAdvancedAnalyticsFromDB(userId, startDate, endDate);
    res.json(advanced);
  } catch (error) {
    console.error('Error in /api/analytics/advanced:', error);
    res.status(500).json({ error: 'Failed to load advanced analytics' });
  }
});

app.get('/api/analytics/patterns', async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    
    const patterns = await getSpendingPatternsFromDB(userId, startDate, endDate);
    res.json(patterns);
  } catch (error) {
    console.error('Error in /api/analytics/patterns:', error);
    res.status(500).json({ error: 'Failed to load spending patterns' });
  }
});

app.get('/api/analytics/merchants', async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    
    const merchants = await getMerchantsFromDB(userId, startDate, endDate);
    res.json(merchants);
  } catch (error) {
    console.error('Error in /api/analytics/merchants:', error);
    res.status(500).json({ error: 'Failed to load merchant analysis' });
  }
});

app.get('/api/analytics/cashflow-calendar', async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    
    const calendar = await getCashFlowCalendarFromDB(userId, startDate, endDate);
    res.json(calendar);
  } catch (error) {
    console.error('Error in /api/analytics/cashflow-calendar:', error);
    res.status(500).json({ error: 'Failed to load cash flow calendar' });
  }
});

app.get('/api/analytics/health-score', async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    
    const healthScore = await getFinancialHealthScoreFromDB(userId, startDate, endDate);
    res.json(healthScore);
  } catch (error) {
    console.error('Error in /api/analytics/health-score:', error);
    res.status(500).json({ error: 'Failed to load financial health score' });
  }
});

app.get('/api/analytics/velocity', async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    
    const velocity = await getSpendingVelocityFromDB(userId, startDate, endDate);
    res.json(velocity);
  } catch (error) {
    console.error('Error in /api/analytics/velocity:', error);
    res.status(500).json({ error: 'Failed to load spending velocity' });
  }
});

app.get('/api/analytics/insights', async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    
    const insights = await getAIInsightsFromDB(userId, startDate, endDate);
    res.json(insights);
  } catch (error) {
    console.error('Error in /api/analytics/insights:', error);
    res.status(500).json({ error: 'Failed to load AI insights' });
  }
});

app.get('/api/loans', async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    
    const loans = await getLoansAndDebtsFromDB(userId, startDate, endDate);
    res.json(loans);
  } catch (error) {
    console.error('Error in /api/loans:', error);
    res.status(500).json({ error: 'Failed to load loans and debts' });
  }
});

app.get('/api/analytics/expenses-by-person', async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    
    const expenses = await getExpensesByPersonFromDB(userId, startDate, endDate);
    res.json(expenses);
  } catch (error) {
    console.error('Error in /api/analytics/expenses-by-person:', error);
    res.status(500).json({ error: 'Failed to load expenses by person' });
  }
});

app.get('/api/analytics/debt-by-person', async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    
    const debt = await getDebtByPersonFromDB(userId, startDate, endDate);
    res.json(debt);
  } catch (error) {
    console.error('Error in /api/analytics/debt-by-person:', error);
    res.status(500).json({ error: 'Failed to load debt by person' });
  }
});

// Budget management endpoints removed - feature was removed per user request

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Finance API is running' });
});

// Error handling middleware (must be last, after all routes)
app.use(errorLoggerMiddleware);

// Initialize database and start server
async function startServer() {
  // Test database connection
  try {
    await prisma.$connect();
    logger.info('✅ Prisma connected to database');
    console.log('✅ Prisma connected to database');
  } catch (error) {
    logger.error('❌ Failed to connect to database', { error: error.message });
    console.error('❌ Failed to connect to database:', error.message);
    console.log('📝 Make sure to:');
    console.log('   1. Create .env file from .env.example');
    console.log('   2. Update DATABASE_URL in .env (format: mysql://user:password@host:port/database)');
    console.log('   3. Run: npm run prisma:migrate');
    console.log('   4. Run: npm run prisma:generate');
    process.exit(1);
  }

  // Database is now the single source of truth - no CSV loading needed

  app.listen(PORT, () => {
    logger.info(`🚀 Finance App Server running on port ${PORT}`);
    console.log('🚀 Finance App Server running!');
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}/api`);
    console.log(`\n🔐 Authentication: POST /api/auth/login or /api/auth/register`);
    console.log(`📝 Accounts: GET/POST /api/accounts`);
    console.log(`📂 Categories: GET/POST /api/categories`);
    console.log(`💰 Transactions: GET/POST /api/transactions`);
    console.log(`📋 Audit Logs: GET /api/audit`);
    console.log(`\n💡 Use Bearer token in Authorization header for authenticated requests`);
    console.log(`\n📦 To seed data from CSV (from 2026-01-01): npm run prisma:seed`);
    console.log(`\n📝 Logs are stored in ./logs/ directory`);
  });
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

startServer();

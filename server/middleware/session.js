// Session management middleware
// Checks session expiration and handles auto-logout after 2 days

/**
 * Middleware to check session expiration and auto-logout
 * Sessions expire after 2 days (48 hours) from login time
 */
function checkSessionExpiration(req, res, next) {
  if (!req.session || !req.session.userId) {
    return next(); // No session, continue (will be handled by auth middleware)
  }

  // Check if session has expired (2 days = 48 hours from login time)
  const sessionMaxAge = 2 * 24 * 60 * 60 * 1000; // 2 days in milliseconds
  const loginTime = req.session.loginTime || req.session.cookie.originalMaxAge 
    ? Date.now() - (req.session.cookie.originalMaxAge - req.session.cookie.maxAge)
    : Date.now();

  // If session is older than 2 days from login, destroy it
  const sessionAge = Date.now() - loginTime;
  if (sessionAge > sessionMaxAge) {
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying expired session:', err);
      }
    });
    return res.status(401).json({ 
      error: 'Session expired after 2 days of inactivity. Please login again.',
      expired: true 
    });
  }

  next();
}

/**
 * Middleware to refresh session on activity
 * Extends session expiration, but not beyond 2 days from login
 */
function refreshSession(req, res, next) {
  if (req.session && req.session.userId) {
    const sessionMaxAge = 2 * 24 * 60 * 60 * 1000; // 2 days
    const loginTime = req.session.loginTime || Date.now();
    const timeSinceLogin = Date.now() - loginTime;
    
    // Only extend if we haven't exceeded 2 days from login
    if (timeSinceLogin < sessionMaxAge) {
      // Calculate remaining time
      const remainingTime = sessionMaxAge - timeSinceLogin;
      req.session.cookie.maxAge = remainingTime;
      req.session.touch();
    }
  }
  next();
}

module.exports = {
  checkSessionExpiration,
  refreshSession
};


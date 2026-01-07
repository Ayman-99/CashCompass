const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

// Verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Use same fallback as generateToken to ensure consistency
  const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret';
  jwt.verify(token, jwtSecret, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Verify user still exists
    try {
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, username: true, email: true }
      });
      
      if (!user) {
        return res.status(403).json({ error: 'User not found' });
      }

      req.user = user;
      next();
    } catch (error) {
      return res.status(500).json({ error: 'Database error' });
    }
  });
}

// Generate JWT token
function generateToken(userId) {
  // Use same fallback as verification to ensure consistency
  const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret';
  return jwt.sign({ userId }, jwtSecret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d' // 7 days (default)
  });
}

module.exports = {
  authenticateToken,
  generateToken
};


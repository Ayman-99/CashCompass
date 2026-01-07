const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/access');
const { createAuditLog } = require('../lib/audit');
const { getClientIp } = require('../middleware/access');
const logger = require('../lib/logger');

const router = express.Router();

// All admin routes require authentication
router.use(requireAuth);

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        canAccessWeb: true,
        allowedIps: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get single user
router.get('/users/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(req.params.id) },
      select: {
        id: true,
        username: true,
        email: true,
        canAccessWeb: true,
        allowedIps: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create user
router.post('/users', async (req, res) => {
  try {
    const { username, email, password, canAccessWeb, allowedIps } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Check if user exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        canAccessWeb: canAccessWeb || false,
        allowedIps: allowedIps || null
      },
      select: {
        id: true,
        username: true,
        email: true,
        canAccessWeb: true,
        allowedIps: true,
        createdAt: true
      }
    });

    // Audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'ADMIN_USER_CREATE',
      entityType: 'User',
      entityId: user.id,
      newValues: { username, email, canAccessWeb, allowedIps },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      description: `Admin created user: ${username}`
    });

    logger.info(`Admin created user: ${username}`, { 
      adminId: req.user.id, 
      userId: user.id 
    });

    res.status(201).json({ 
      success: true, 
      message: 'User created successfully',
      user 
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
router.put('/users/:id', async (req, res) => {
  try {
    const { username, email, password, canAccessWeb, allowedIps } = req.body;

    // Get existing user
    const existing = await prisma.user.findUnique({
      where: { id: parseInt(req.params.id) }
    });

    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if username/email already exists (excluding current user)
    if (username || email) {
      const duplicate = await prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: parseInt(req.params.id) } },
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
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (password) updateData.passwordHash = await bcrypt.hash(password, 10);
    if (canAccessWeb !== undefined) updateData.canAccessWeb = canAccessWeb;
    if (allowedIps !== undefined) updateData.allowedIps = allowedIps || null;

    // Update user
    const user = await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        canAccessWeb: true,
        allowedIps: true,
        createdAt: true
      }
    });

    // Audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'ADMIN_USER_UPDATE',
      entityType: 'User',
      entityId: user.id,
      oldValues: {
        username: existing.username,
        email: existing.email,
        canAccessWeb: existing.canAccessWeb,
        allowedIps: existing.allowedIps
      },
      newValues: {
        username: user.username,
        email: user.email,
        canAccessWeb: user.canAccessWeb,
        allowedIps: user.allowedIps
      },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      description: `Admin updated user: ${user.username}`
    });

    logger.info(`Admin updated user: ${user.username}`, { 
      adminId: req.user.id, 
      userId: user.id 
    });

    res.json({ 
      success: true, 
      message: 'User updated successfully',
      user 
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Prevent self-deletion
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Get user before deletion for audit
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete user
    await prisma.user.delete({
      where: { id: userId }
    });

    // Audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'ADMIN_USER_DELETE',
      entityType: 'User',
      entityId: userId,
      oldValues: { username: user.username, email: user.email },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      description: `Admin deleted user: ${user.username}`
    });

    logger.info(`Admin deleted user: ${user.username}`, { 
      adminId: req.user.id, 
      userId: userId 
    });

    res.json({ 
      success: true, 
      message: 'User deleted successfully' 
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;


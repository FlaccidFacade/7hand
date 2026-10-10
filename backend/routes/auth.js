const express = require('express');
const { loadUserByUsernameFromDb, updateUserActivity } = require('../user');
const logger = require('../logger');
const RateLimit = require('express-rate-limit');

const router = express.Router();

// Initialize userManager - will be set by index.js
let userManager;

function setUserManager(manager) {
  userManager = manager;
}

// Rate limiter for login attempts to prevent brute force and DoS
const loginLimiter = RateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 login requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false   // Disable the `X-RateLimit-*` headers
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Load user from database
    const dbUser = await loadUserByUsernameFromDb(username);
    if (!dbUser) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    // Create User instance with password hash
    const user = userManager.createUser({
      id: dbUser.id,
      username: dbUser.username,
      displayName: dbUser.display_name,
      email: dbUser.email,
      coins: dbUser.coins,
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at,
      lastActive: dbUser.last_active,
      stats: dbUser.stats,
      cookieConsent: dbUser.cookie_consent,
      passwordHash: dbUser.password_hash
    });
    
    // Verify password
    const isValid = await user.verifyPassword(password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    // Update activity
    user.updateActivity();
    await updateUserActivity(user.id);
    
    logger.info(`User logged in: ${user.username} (${user.id})`);
    
    // Return user without sensitive data
    res.json({
      success: true,
      user: user.toSafeObject()
    });
  } catch (error) {
    logger.error('Login error', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
module.exports.setUserManager = setUserManager;

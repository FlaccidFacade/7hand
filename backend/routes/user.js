const express = require('express');
const { saveUserToDb, removeUserFromDb, loadUserFromDb, loadUserByUsernameFromDb, loadAllUsersFromDb, updateUserActivity } = require('../user');
const logger = require('../logger');

const router = express.Router();

// Initialize userManager - will be set by index.js
let userManager;

function setUserManager(manager) {
  userManager = manager;
}

router.post('/', async (req, res) => {
  try {
    const { username, password, displayName, email } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Check if username already exists
    const existingUser = await loadUserByUsernameFromDb(username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    
    // Create new user
    const user = userManager.createUser({
      username,
      password,
      displayName: displayName || username,
      email
    });
    
    await saveUserToDb(user);
    logger.info(`User created: ${user.username} (${user.id})`);
    
    res.status(201).json(user.toSafeObject());
  } catch (error) {
    logger.error('Error creating user', error);
    res.status(400).json({ error: error.message });
  }
});

router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  let user = userManager.getUser(userId);
  
  if (!user) {
    const dbUser = await loadUserFromDb(userId);
    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    user = userManager.createUser({
      id: dbUser.id,
      username: dbUser.username,
      displayName: dbUser.display_name,
      email: dbUser.email,
      coins: dbUser.coins,
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at,
      lastActive: dbUser.last_active,
      stats: dbUser.stats
    });
  }
  
  res.json(user.toSafeObject());
});

router.get('/username/:username', async (req, res) => {
  const { username } = req.params;
  let user = userManager.getUserByUsername(username);
  
  if (!user) {
    const dbUser = await loadUserByUsernameFromDb(username);
    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    user = userManager.createUser({
      id: dbUser.id,
      username: dbUser.username,
      displayName: dbUser.display_name,
      email: dbUser.email,
      coins: dbUser.coins,
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at,
      lastActive: dbUser.last_active,
      stats: dbUser.stats
    });
  }
  
  res.json(user.toSafeObject());
});

router.get('/', async (req, res) => {
  try {
    const users = await loadAllUsersFromDb();
    res.json(users.map(u => ({
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      coins: u.coins,
      stats: u.stats,
      createdAt: u.created_at,
      lastActive: u.last_active
    })));
  } catch (error) {
    logger.error('Error loading users', error);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

router.patch('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = userManager.updateUser(userId, req.body);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await saveUserToDb(user);
    logger.info(`User updated: ${user.username} (${user.id})`);
    res.json(user.toSafeObject());
  } catch (error) {
    logger.error('Error updating user', error);
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:userId', async (req, res) => {
  const { userId } = req.params;
  userManager.removeUser(userId);
  await removeUserFromDb(userId);
  logger.info(`User deleted: ${userId}`);
  res.json({ success: true });
});

router.post('/:userId/activity', async (req, res) => {
  const { userId } = req.params;
  const user = userManager.getUser(userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  user.updateActivity();
  await updateUserActivity(userId);
  res.json({ success: true });
});

module.exports = router;
module.exports.setUserManager = setUserManager;

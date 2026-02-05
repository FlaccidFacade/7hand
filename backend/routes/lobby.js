const express = require('express');
const { saveLobbyToDb, removeLobbyFromDb, loadLobbyFromDb } = require('../lobby');
const { loadUserFromDb, updateUserActivity } = require('../user');
const logger = require('../logger');

const router = express.Router();

// Initialize managers - will be set by index.js
let lobbyManager;
let userManager;

function setManagers(lobby, user) {
  lobbyManager = lobby;
  userManager = user;
}

router.post('/', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID required' });
  
  // Get or load user
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
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at,
      lastActive: dbUser.last_active,
      stats: dbUser.stats
    });
  }
  
  user.updateActivity();
  await updateUserActivity(userId);
  
  const lobby = lobbyManager.createLobby(user.toSafeObject());
  await saveLobbyToDb(lobby);
  logger.info(`Lobby created: ${lobby.id} by user ${user.username}`);
  res.json({ lobbyId: lobby.id, users: lobby.users });
});

router.post('/:lobbyId/join', async (req, res) => {
  const { userId } = req.body;
  const { lobbyId } = req.params;
  
  if (!userId) return res.status(400).json({ error: 'User ID required' });
  
  // Get or load user
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
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at,
      lastActive: dbUser.last_active,
      stats: dbUser.stats
    });
  }
  
  user.updateActivity();
  await updateUserActivity(userId);
  
  const lobby = lobbyManager.getLobby(lobbyId);
  if (!lobby) return res.status(404).json({ error: 'Lobby not found' });
  
  lobby.addUser(user.toSafeObject());
  await saveLobbyToDb(lobby);
  logger.info(`User ${user.username} joined lobby ${lobby.id}`);
  res.json({ lobbyId: lobby.id, users: lobby.users });
});

router.get('/:lobbyId', async (req, res) => {
  const { lobbyId } = req.params;
  let lobby = lobbyManager.getLobby(lobbyId);
  if (!lobby) {
    // Try to load from DB if not in memory
    const dbLobby = await loadLobbyFromDb(lobbyId);
    if (!dbLobby) return res.status(404).json({ error: 'Lobby not found' });
    lobby = lobbyManager.createLobby({ id: 'restored' }); // placeholder user
    lobby.id = dbLobby.id;
    lobby.users = dbLobby.users;
    lobby.gamestate = dbLobby.gamestate;
    lobby.createdAt = dbLobby.created_at;
    lobby.lastActivity = dbLobby.last_activity;
    lobby.started = dbLobby.started;
  }
  res.json({ lobbyId: lobby.id, users: lobby.users });
});

router.delete('/:lobbyId', async (req, res) => {
  const { lobbyId } = req.params;
  lobbyManager.removeLobby(lobbyId);
  await removeLobbyFromDb(lobbyId);
  res.json({ success: true });
});

module.exports = router;
module.exports.setManagers = setManagers;

const express = require('express');
const { saveLobbyToDb, removeLobbyFromDb, loadLobbyFromDb } = require('../lobby');
const { loadUserFromDb, updateUserActivity } = require('../user');
const logger = require('../logger');

const router = express.Router();

// Initialize managers - will be set by index.js
let lobbyManager;
let userManager;

// In-memory storage for signaling messages
// Structure: { lobbyId: { userId: [messages] } }
const signalingMessages = new Map();

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
  // Clean up signaling messages
  signalingMessages.delete(lobbyId);
  res.json({ success: true });
});

// WebRTC signaling endpoints

// Post a signaling message to the lobby
router.post('/:lobbyId/signal', (req, res) => {
  const { lobbyId } = req.params;
  const message = req.body;
  
  if (!message.type || !message.from || !message.to) {
    return res.status(400).json({ error: 'Invalid signaling message' });
  }
  
  // Initialize lobby signaling storage if needed
  if (!signalingMessages.has(lobbyId)) {
    signalingMessages.set(lobbyId, new Map());
  }
  
  const lobbyMessages = signalingMessages.get(lobbyId);
  
  // Initialize user message queue if needed
  if (!lobbyMessages.has(message.to)) {
    lobbyMessages.set(message.to, []);
  }
  
  // Add message to recipient's queue
  lobbyMessages.get(message.to).push(message);
  
  logger.info(`Signaling message queued in lobby ${lobbyId}: ${message.type} from ${message.from} to ${message.to}`);
  res.json({ success: true });
});

// Get signaling messages for a user
router.get('/:lobbyId/signal/:userId', (req, res) => {
  const { lobbyId, userId } = req.params;
  
  const lobbyMessages = signalingMessages.get(lobbyId);
  if (!lobbyMessages || !lobbyMessages.has(userId)) {
    return res.json([]);
  }
  
  // Get all messages for this user and clear the queue
  const messages = lobbyMessages.get(userId) || [];
  lobbyMessages.set(userId, []);
  
  res.json(messages);
});

// Notify that a user joined the lobby
router.post('/:lobbyId/notify-joined', (req, res) => {
  const { lobbyId } = req.params;
  const { userId } = req.body;
  
  if (!userId) return res.status(400).json({ error: 'User ID required' });
  
  const lobby = lobbyManager.getLobby(lobbyId);
  if (!lobby) return res.status(404).json({ error: 'Lobby not found' });
  
  // Initialize lobby signaling storage if needed
  if (!signalingMessages.has(lobbyId)) {
    signalingMessages.set(lobbyId, new Map());
  }
  
  const lobbyMessages = signalingMessages.get(lobbyId);
  
  // Notify all other users in the lobby
  lobby.users.forEach(user => {
    if (user.id !== userId) {
      if (!lobbyMessages.has(user.id)) {
        lobbyMessages.set(user.id, []);
      }
      lobbyMessages.get(user.id).push({
        type: 'peer-joined',
        from: userId,
        to: user.id
      });
    }
  });
  
  logger.info(`User ${userId} joined lobby ${lobbyId}, notifications sent`);
  res.json({ success: true });
});

// Notify that a user left the lobby
router.post('/:lobbyId/notify-left', (req, res) => {
  const { lobbyId } = req.params;
  const { userId } = req.body;
  
  if (!userId) return res.status(400).json({ error: 'User ID required' });
  
  const lobby = lobbyManager.getLobby(lobbyId);
  
  // Initialize lobby signaling storage if needed
  if (!signalingMessages.has(lobbyId)) {
    signalingMessages.set(lobbyId, new Map());
  }
  
  const lobbyMessages = signalingMessages.get(lobbyId);
  
  // Notify all users in the lobby (even if lobby doesn't exist)
  if (lobby) {
    lobby.users.forEach(user => {
      if (user.id !== userId) {
        if (!lobbyMessages.has(user.id)) {
          lobbyMessages.set(user.id, []);
        }
        lobbyMessages.get(user.id).push({
          type: 'peer-left',
          from: userId,
          to: user.id
        });
      }
    });
  }
  
  // Clean up user's message queue
  lobbyMessages.delete(userId);
  
  logger.info(`User ${userId} left lobby ${lobbyId}, notifications sent`);
  res.json({ success: true });
});

// Leave lobby endpoint
router.post('/:lobbyId/leave', async (req, res) => {
  const { userId } = req.body;
  const { lobbyId } = req.params;
  
  if (!userId) return res.status(400).json({ error: 'User ID required' });
  
  const lobby = lobbyManager.getLobby(lobbyId);
  if (!lobby) return res.status(404).json({ error: 'Lobby not found' });
  
  // Remove user from lobby
  lobby.users = lobby.users.filter(u => u.id !== userId);
  await saveLobbyToDb(lobby);
  
  logger.info(`User ${userId} left lobby ${lobbyId}`);
  res.json({ success: true });
});

module.exports = router;
module.exports.setManagers = setManagers;

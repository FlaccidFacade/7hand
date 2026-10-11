const express = require('express');
const { serializeLobby, saveLobbyToDb, createAndSaveLobby, removeLobbyFromDb, loadLobbyFromDb } = require('../lobby');
const { loadUserFromDb, updateUserActivity } = require('../user');
const logger = require('../logger');

const router = express.Router();

// Initialize managers - will be set by index.js
let lobbyManager;
let userManager;

// In-memory storage for signaling messages
// Structure: { lobbyId: { userId: [messages] } }
const signalingMessages = new Map();

// Maximum messages per user to prevent memory issues
const MAX_MESSAGES_PER_USER = 100;

// Cleanup old messages periodically
setInterval(() => {
  cleanupOldSignalingMessages();
}, 5 * 60 * 1000).unref(); // Every 5 minutes

function cleanupOldSignalingMessages() {
  signalingMessages.forEach((lobbyMessages, lobbyId) => {
    lobbyMessages.forEach((messages, userId) => {
      // Keep only the most recent messages
      if (messages.length > MAX_MESSAGES_PER_USER) {
        lobbyMessages.set(userId, messages.slice(-MAX_MESSAGES_PER_USER));
      }
    });
  });
}

// Resolves a public lobby code to a live lobby (memory first, then DB) and counts the access as activity
async function findLobby(code) {
  let lobby = lobbyManager.getLobby(code);
  if (!lobby) {
    const dbLobby = await loadLobbyFromDb(code);
    if (!dbLobby) return null;
    lobby = lobbyManager.restoreLobby(dbLobby);
  }
  lobby.touch();
  return lobby;
}

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
  
  const lobby = await createAndSaveLobby(lobbyManager, user.toSafeObject());
  logger.info(`Lobby created: ${lobby.code} by user ${user.username}`);
  res.json(serializeLobby(lobby));
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
  
  const lobby = await findLobby(lobbyId);
  if (!lobby) return res.status(404).json({ error: 'Lobby not found' });
  
  lobby.addUser(user.toSafeObject());
  await saveLobbyToDb(lobby);
  logger.info(`User ${user.username} joined lobby ${lobby.code}`);
  res.json(serializeLobby(lobby));
});

router.get('/:lobbyId', async (req, res) => {
  const { lobbyId } = req.params;
  const lobby = await findLobby(lobbyId);
  if (!lobby) return res.status(404).json({ error: 'Lobby not found' });
  await saveLobbyToDb(lobby);
  res.json(serializeLobby(lobby));
});

// Start a game against computer players (host only, no other humans seated)
router.post('/:lobbyId/start-bot-game', async (req, res) => {
  const { userId } = req.body;
  const { lobbyId } = req.params;

  if (!userId) return res.status(400).json({ error: 'User ID required' });

  const lobby = await findLobby(lobbyId);
  if (!lobby) return res.status(404).json({ error: 'Lobby not found' });
  if (lobby.users[0]?.id !== userId) {
    return res.status(403).json({ error: 'Only the host can start a bot game' });
  }
  if (lobby.started) return res.status(409).json({ error: 'Game already started' });
  if (lobby.humanUsers.length > 1) {
    return res.status(409).json({ error: 'Bot games can only be started without other players' });
  }

  lobby.startBotGame();
  await saveLobbyToDb(lobby);
  logger.info(`Bot game started in lobby ${lobby.code} by user ${userId}`);
  res.json(serializeLobby(lobby));
});

// Periodic client-side save of the game state
router.put('/:lobbyId/gamestate', async (req, res) => {
  const { userId, gamestate } = req.body;
  const { lobbyId } = req.params;

  if (!userId) return res.status(400).json({ error: 'User ID required' });
  if (!gamestate || typeof gamestate !== 'object' || Array.isArray(gamestate)) {
    return res.status(400).json({ error: 'Invalid game state' });
  }

  const lobby = await findLobby(lobbyId);
  if (!lobby) return res.status(404).json({ error: 'Lobby not found' });
  if (!lobby.users.some(u => u.id === userId)) {
    return res.status(403).json({ error: 'Not a member of this lobby' });
  }
  if (!lobby.started) return res.status(409).json({ error: 'Game not started' });

  lobby.gamestate = gamestate;
  lobby.lastActivity = new Date();
  await saveLobbyToDb(lobby);
  res.json({ success: true });
});

router.delete('/:lobbyId', async (req, res) => {
  const { lobbyId } = req.params;
  const lobby = await findLobby(lobbyId);
  if (lobby) {
    lobbyManager.removeLobby(lobby.code);
    await removeLobbyFromDb(lobby.id);
    // Clean up signaling messages
    signalingMessages.delete(lobbyId);
  }
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
  
  // Add message to recipient's queue with size limit
  const userMessages = lobbyMessages.get(message.to);
  userMessages.push(message);
  
  // Keep only the most recent messages to prevent memory issues
  if (userMessages.length > MAX_MESSAGES_PER_USER) {
    lobbyMessages.set(message.to, userMessages.slice(-MAX_MESSAGES_PER_USER));
  }
  
  logger.info(`Signaling message queued in lobby ${lobbyId}: ${message.type} from ${message.from} to ${message.to}`);
  res.json({ success: true });
});

// Get signaling messages for a user
router.get('/:lobbyId/signal/:userId', (req, res) => {
  const { lobbyId, userId } = req.params;

  lobbyManager.getLobby(lobbyId)?.touch();
  
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
  
  const lobby = await findLobby(lobbyId);
  if (!lobby) return res.status(404).json({ error: 'Lobby not found' });
  
  // Remove user from lobby
  lobby.removeUser(userId);
  await saveLobbyToDb(lobby);
  
  logger.info(`User ${userId} left lobby ${lobbyId}`);
  res.json({ success: true });
});

module.exports = router;
module.exports.setManagers = setManagers;

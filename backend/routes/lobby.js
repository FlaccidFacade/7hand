const express = require('express');
const {
  MAX_PLAYERS,
  MIN_PLAYERS,
  normalizeLobbyCode,
  serializeLobby,
  saveLobbyToDb,
  createAndSaveLobby,
  removeLobbyFromDb,
  loadLobbyFromDb
} = require('../lobby');
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

// Message types peers may relay to each other; peer-joined and peer-left are only produced by the server
const RELAYED_TYPES = new Set(['offer', 'answer', 'ice-candidate']);

function cleanupOldSignalingMessages() {
  signalingMessages.forEach((lobbyMessages, lobbyId) => {
    // Nothing can read the queues of a lobby that no longer exists
    if (!lobbyManager?.getLobby(lobbyId)) {
      signalingMessages.delete(lobbyId);
      return;
    }
    lobbyMessages.forEach((messages, userId) => {
      // Keep only the most recent messages
      if (messages.length > MAX_MESSAGES_PER_USER) {
        lobbyMessages.set(userId, messages.slice(-MAX_MESSAGES_PER_USER));
      }
    });
  });
}

// Queues are keyed by the public lobby code, so "abc234" and "ABC234" share one set of queues
function lobbyQueues(lobbyId) {
  const key = normalizeLobbyCode(lobbyId);
  if (!signalingMessages.has(key)) {
    signalingMessages.set(key, new Map());
  }
  return signalingMessages.get(key);
}

function enqueue(queues, userId, message) {
  const queue = queues.get(userId) || [];
  queue.push(message);
  queues.set(userId, queue.length > MAX_MESSAGES_PER_USER ? queue.slice(-MAX_MESSAGES_PER_USER) : queue);
}

function isMember(lobby, userId) {
  return lobby.users.some(u => u.id === userId);
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

  // Members can always come back; newcomers need an open seat in a game that has not begun
  if (!isMember(lobby, user.id)) {
    if (lobby.started) return res.status(409).json({ error: 'Game already started' });
    if (lobby.users.length >= MAX_PLAYERS) return res.status(409).json({ error: 'Lobby is full' });
  }
  
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

// Start a game between the people in the lobby (host only). Players left off the optional
// playerIds list (for example those who could not connect to the host) are not seated.
router.post('/:lobbyId/start-game', async (req, res) => {
  const { userId, playerIds } = req.body;
  const { lobbyId } = req.params;

  if (!userId) return res.status(400).json({ error: 'User ID required' });
  if (playerIds !== undefined && !(Array.isArray(playerIds) && playerIds.every(id => typeof id === 'string'))) {
    return res.status(400).json({ error: 'Invalid player list' });
  }

  const lobby = await findLobby(lobbyId);
  if (!lobby) return res.status(404).json({ error: 'Lobby not found' });
  if (lobby.users[0]?.id !== userId) {
    return res.status(403).json({ error: 'Only the host can start the game' });
  }
  if (lobby.started) return res.status(409).json({ error: 'Game already started' });
  if (lobby.seatedPlayers(playerIds).length < MIN_PLAYERS) {
    return res.status(409).json({ error: 'At least two players are needed' });
  }

  lobby.startGame(playerIds);
  await saveLobbyToDb(lobby);
  logger.info(`Game started in lobby ${lobby.code} by user ${userId} with ${lobby.users.length} players`);
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
  lobby.syncScores();
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
    signalingMessages.delete(lobby.code);
  }
  res.json({ success: true });
});

// WebRTC signaling endpoints

// Post a signaling message to another member of the lobby
router.post('/:lobbyId/signal', (req, res) => {
  const { lobbyId } = req.params;
  const message = req.body;

  if (!RELAYED_TYPES.has(message?.type) || typeof message.from !== 'string' || typeof message.to !== 'string') {
    return res.status(400).json({ error: 'Invalid signaling message' });
  }

  const lobby = lobbyManager.getLobby(lobbyId);
  if (!lobby) return res.status(404).json({ error: 'Lobby not found' });
  if (!isMember(lobby, message.from) || !isMember(lobby, message.to)) {
    return res.status(403).json({ error: 'Not a member of this lobby' });
  }

  const { type, from, to, connectionId, payload } = message;
  enqueue(lobbyQueues(lobbyId), to, { type, from, to, connectionId, payload });

  logger.info(`Signaling message queued in lobby ${lobby.code}: ${type} from ${from} to ${to}`);
  res.json({ success: true });
});

// Get signaling messages for a user and clear their queue
router.get('/:lobbyId/signal/:userId', (req, res) => {
  const { lobbyId, userId } = req.params;

  lobbyManager.getLobby(lobbyId)?.touch();

  const queues = signalingMessages.get(normalizeLobbyCode(lobbyId));
  const messages = queues?.get(userId) || [];
  queues?.delete(userId);

  res.json(messages);
});

// Notify that a user joined the lobby
router.post('/:lobbyId/notify-joined', (req, res) => {
  const { lobbyId } = req.params;
  const { userId } = req.body;

  if (!userId) return res.status(400).json({ error: 'User ID required' });

  const lobby = lobbyManager.getLobby(lobbyId);
  if (!lobby) return res.status(404).json({ error: 'Lobby not found' });
  if (!isMember(lobby, userId)) {
    return res.status(403).json({ error: 'Not a member of this lobby' });
  }

  const queues = lobbyQueues(lobbyId);

  // Whatever is still queued for this user was meant for an earlier visit
  queues.delete(userId);

  lobby.humanUsers.forEach(user => {
    if (user.id !== userId) {
      enqueue(queues, user.id, { type: 'peer-joined', from: userId, to: user.id });
    }
  });

  logger.info(`User ${userId} joined lobby ${lobby.code}, notifications sent`);
  res.json({ success: true });
});

// Notify that a user left the lobby
router.post('/:lobbyId/notify-left', (req, res) => {
  const { lobbyId } = req.params;
  const { userId } = req.body;

  if (typeof userId !== 'string' || !userId) return res.status(400).json({ error: 'User ID required' });

  const lobby = lobbyManager.getLobby(lobbyId);
  if (lobby) {
    const queues = lobbyQueues(lobbyId);
    lobby.humanUsers.forEach(user => {
      if (user.id !== userId) {
        enqueue(queues, user.id, { type: 'peer-left', from: userId, to: user.id });
      }
    });
  }

  // The user no longer needs their own queue
  signalingMessages.get(normalizeLobbyCode(lobbyId))?.delete(userId);

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

const express = require('express');
const cors = require('cors');
const { connect, disconnect } = require('./db');
const { getHealthStatus } = require('./health');
const { LobbyManager, saveLobbyToDb, removeLobbyFromDb, loadLobbyFromDb, cleanupInactiveLobbies } = require('./lobby');
const { UserManager, saveUserToDb, removeUserFromDb, loadUserFromDb, loadUserByUsernameFromDb, loadAllUsersFromDb, updateUserActivity } = require('./user');
const logger = require('./logger');
const { execSync } = require('child_process');
const app = express();
const PORT = 3000;

app.use(cors({ origin: 'http://localhost', credentials: true }));
app.use(express.json());

const lobbyManager = new LobbyManager();
const userManager = new UserManager();

// Run DB migrations automatically on startup
try {
  execSync('npm run migrate', { stdio: 'inherit' });
  logger.info('Database migrations complete');
} catch (err) {
  logger.error('Database migration failed', err);
  process.exit(1);
}

// Periodic cleanup of inactive lobbies every 30 minutes
const timer = setInterval(() => {
  cleanupInactiveLobbies(2).catch(err => logger.error('Cleanup failed', err));
}, 30 * 60 * 1000);

app.get('/', (req, res) => {
  logger.info('Root endpoint hit');
  res.send('Card Game Backend Running');
});

app.get('/health', async (req, res) => {
  const status = await getHealthStatus(logger);
  res.json(status);
});

app.get('/api/health', async (req, res) => {
  const status = await getHealthStatus(logger);
  res.json(status);
});

// Lobby endpoints
app.post('/api/lobby', async (req, res) => {
  const { user } = req.body;
  if (!user || !user.id) return res.status(400).json({ error: 'User info required' });
  const lobby = lobbyManager.createLobby(user);
  await saveLobbyToDb(lobby);
  res.json({ lobbyId: lobby.id, users: lobby.users });
});

app.post('/api/lobby/:lobbyId/join', async (req, res) => {
  const { user } = req.body;
  const { lobbyId } = req.params;
  const lobby = lobbyManager.getLobby(lobbyId);
  if (!lobby) return res.status(404).json({ error: 'Lobby not found' });
  lobby.addUser(user);
  await saveLobbyToDb(lobby);
  res.json({ lobbyId: lobby.id, users: lobby.users });
});

app.get('/api/lobby/:lobbyId', async (req, res) => {
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

app.delete('/api/lobby/:lobbyId', async (req, res) => {
  const { lobbyId } = req.params;
  lobbyManager.removeLobby(lobbyId);
  await removeLobbyFromDb(lobbyId);
  res.json({ success: true });
});

// User endpoints
app.post('/api/user', async (req, res) => {
  try {
    const user = userManager.createUser(req.body);
    await saveUserToDb(user);
    logger.info(`User created: ${user.username} (${user.id})`);
    res.json(user.toSafeObject());
  } catch (error) {
    logger.error('Error creating user', error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/user/:userId', async (req, res) => {
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
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at,
      lastActive: dbUser.last_active,
      stats: dbUser.stats
    });
  }
  
  res.json(user.toSafeObject());
});

app.get('/api/user/username/:username', async (req, res) => {
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
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at,
      lastActive: dbUser.last_active,
      stats: dbUser.stats
    });
  }
  
  res.json(user.toSafeObject());
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await loadAllUsersFromDb();
    res.json(users.map(u => ({
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      stats: u.stats,
      createdAt: u.created_at,
      lastActive: u.last_active
    })));
  } catch (error) {
    logger.error('Error loading users', error);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

app.patch('/api/user/:userId', async (req, res) => {
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

app.delete('/api/user/:userId', async (req, res) => {
  const { userId } = req.params;
  userManager.removeUser(userId);
  await removeUserFromDb(userId);
  logger.info(`User deleted: ${userId}`);
  res.json({ success: true });
});

app.post('/api/user/:userId/activity', async (req, res) => {
  const { userId } = req.params;
  const user = userManager.getUser(userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  user.updateActivity();
  await updateUserActivity(userId);
  res.json({ success: true });
});

process.on('SIGINT', async () => {
  clearInterval(timer);
  await disconnect();
  logger.info('Backend shutting down');
  process.exit(0);
});

connect()
  .then(() => {
    app.listen(PORT, () => {
      logger.info(`Backend listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    logger.error('Failed to connect to database, exiting.', err);
    process.exit(1);
  });

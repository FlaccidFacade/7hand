const express = require('express');
const cors = require('cors');
const { connect, disconnect } = require('./db');
const { getHealthStatus } = require('./health');
const { LobbyManager, saveLobbyToDb, removeLobbyFromDb, loadLobbyFromDb, cleanupInactiveLobbies } = require('./lobby');
const logger = require('./logger');
const { execSync } = require('child_process');
const app = express();
const PORT = 3000;

app.use(cors({ origin: 'http://localhost', credentials: true }));
app.use(express.json());

const lobbyManager = new LobbyManager();

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

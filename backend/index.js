const express = require('express');
const cors = require('cors');
const { connect, disconnect } = require('./db');
const { LobbyManager, cleanupInactiveLobbies } = require('./lobby');
const { UserManager } = require('./user');
const logger = require('./logger');
const { execSync } = require('child_process');

// Import route modules
const healthRoutes = require('./routes/health');
const lobbyRoutes = require('./routes/lobby');
const userRoutes = require('./routes/user');
const authRoutes = require('./routes/auth');
const configRoutes = require('./routes/config');

const app = express();
const PORT = 3000;

app.use(cors({ origin: ['http://localhost', 'http://localhost:4200', 'http://localhost:80'], credentials: true }));
app.use(express.json());

const lobbyManager = new LobbyManager();
const userManager = new UserManager();

// Set managers for route modules that need them
lobbyRoutes.setManagers(lobbyManager, userManager);
userRoutes.setUserManager(userManager);
authRoutes.setUserManager(userManager);

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

// Root endpoint
app.get('/', (req, res) => {
  logger.info('Root endpoint hit');
  res.send('Card Game Backend Running');
});

// Mount route modules
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/lobby', lobbyRoutes);
app.use('/api/user', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/config', configRoutes);

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

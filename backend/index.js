const express = require('express');
const cors = require('cors');
const { connect, disconnect } = require('./db');
const { getHealthStatus } = require('./health');
const logger = require('./logger');
const app = express();
const PORT = 3000;

app.use(cors({ origin: 'http://localhost', credentials: true }));

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

process.on('SIGINT', async () => {
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

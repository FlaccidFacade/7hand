// Handles all health check logic for the backend
const { getPool } = require('./db');

async function getHealthStatus(logger) {
  let dbStatus = 'down';
  let dbVersion = null;
  try {
    const result = await getPool().query('SELECT version()');
    dbStatus = 'up';
    dbVersion = result.rows[0].version;
  } catch (err) {
    if (logger) logger.error('DB health check failed:', err);
  }
  return {
    api: 'up',
    apiVersion: process.env.npm_package_version || '1.0.0',
    db: dbStatus,
    dbVersion: dbVersion,
  };
}

module.exports = { getHealthStatus };

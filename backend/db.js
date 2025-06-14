const { Pool } = require('pg');

const poolConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

let pool;

async function connect(retries = 100, delay = 30000) {
  for (let i = 0; i < retries; i++) {
    try {
      pool = new Pool(poolConfig);
      await pool.query('SELECT 1');
      console.log('Connected to PostgreSQL');
      return;
    } catch (err) {
      console.error(`PostgreSQL connection error (attempt ${i + 1}):`, err);
      if (i === retries - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

function getPool() {
  if (!pool) throw new Error('Database pool not initialized');
  return pool;
}

async function disconnect() {
  try {
    if (pool) {
      await pool.end();
      console.log('Disconnected from PostgreSQL');
    }
  } catch (err) {
    console.error('Error disconnecting from PostgreSQL:', err);
  }
}

module.exports = { getPool, connect, disconnect };

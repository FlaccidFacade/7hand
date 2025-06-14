const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function connect() {
  try {
    await pool.connect();
    console.log('Connected to PostgreSQL');
  } catch (err) {
    console.error('PostgreSQL connection error:', err);
    throw err;
  }
}

async function disconnect() {
  try {
    await pool.end();
    console.log('Disconnected from PostgreSQL');
  } catch (err) {
    console.error('Error disconnecting from PostgreSQL:', err);
  }
}

module.exports = { pool, connect, disconnect };

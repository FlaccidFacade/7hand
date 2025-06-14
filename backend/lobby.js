// lobby.js - Handles lobby creation and user management

const { v4: uuidv4 } = require('uuid');
const { getPool } = require('./db');

class Lobby {
  constructor(hostUser) {
    this.id = uuidv4();
    this.users = [hostUser];
    this.createdAt = new Date();
    this.started = false;
  }

  addUser(user) {
    if (!this.users.find(u => u.id === user.id)) {
      this.users.push(user);
    }
  }

  removeUser(userId) {
    this.users = this.users.filter(u => u.id !== userId);
  }
}

class LobbyManager {
  constructor() {
    this.lobbies = new Map();
  }

  createLobby(hostUser) {
    const lobby = new Lobby(hostUser);
    this.lobbies.set(lobby.id, lobby);
    return lobby;
  }

  getLobby(lobbyId) {
    return this.lobbies.get(lobbyId);
  }

  removeLobby(lobbyId) {
    this.lobbies.delete(lobbyId);
  }
}

async function saveLobbyToDb(lobby) {
  const pool = getPool();
  const now = new Date();
  await pool.query(
    `INSERT INTO lobbies (id, users, gamestate, created_at, updated_at, last_activity, started)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET
       users = EXCLUDED.users,
       gamestate = EXCLUDED.gamestate,
       updated_at = EXCLUDED.updated_at,
       last_activity = EXCLUDED.last_activity,
       started = EXCLUDED.started`,
    [
      lobby.id,
      JSON.stringify(lobby.users),
      JSON.stringify(lobby.gamestate || {}),
      lobby.createdAt || now,
      now,
      lobby.lastActivity || now,
      lobby.started || false
    ]
  );
}

async function removeLobbyFromDb(lobbyId) {
  const pool = getPool();
  await pool.query('DELETE FROM lobbies WHERE id = $1', [lobbyId]);
}

async function loadLobbyFromDb(lobbyId) {
  const pool = getPool();
  const res = await pool.query('SELECT * FROM lobbies WHERE id = $1', [lobbyId]);
  return res.rows[0] || null;
}

async function cleanupInactiveLobbies(hours = 2) {
  const pool = getPool();
  const safeHours = Number(hours) || 2;
  await pool.query(
    `DELETE FROM lobbies WHERE last_activity < NOW() - INTERVAL '${safeHours} hours'`
  );
}

module.exports = {
  Lobby,
  LobbyManager,
  saveLobbyToDb,
  removeLobbyFromDb,
  loadLobbyFromDb,
  cleanupInactiveLobbies,
};

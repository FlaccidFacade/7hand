// lobby.js - Handles lobby creation and user management

const { randomInt } = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { getPool } = require('./db');
const { dealGame } = require('./game');

const MAX_PLAYERS = 6;

// Public lobby codes replace the internal UUID in URLs and API responses.
// The alphabet skips look-alike characters (0/O, 1/I).
const CODE_LENGTH = 6;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);
const CODE_TTL_MINUTES = 30;
const CODE_TTL_MS = CODE_TTL_MINUTES * 60 * 1000;
const MAX_CODE_ATTEMPTS = 10;

function generateLobbyCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

function normalizeLobbyCode(code) {
  return typeof code === 'string' ? code.trim().toUpperCase() : '';
}

class Lobby {
  constructor(hostUser) {
    this.id = uuidv4();
    this.code = generateLobbyCode();
    this.users = [hostUser];
    this.createdAt = new Date();
    this.lastActivity = this.createdAt;
    this.started = false;
    this.gamestate = null;
  }

  touch() {
    this.lastActivity = new Date();
  }

  // The code is only valid while the lobby has been active within the last 30 minutes
  isExpired(now = Date.now()) {
    return now - new Date(this.lastActivity).getTime() > CODE_TTL_MS;
  }

  get humanUsers() {
    return this.users.filter(u => !u.isBot);
  }

  // Fills every open seat with a bot, deals the cards and marks the lobby started
  startBotGame() {
    if (this.started) {
      throw new Error('Game already started');
    }
    const botCount = MAX_PLAYERS - this.users.length;
    for (let i = 0; i < botCount; i++) {
      const n = i + 1;
      this.users.push({
        id: `bot-${n}`,
        username: `bot${n}`,
        displayName: `Bot ${n}`,
        isBot: true
      });
    }
    this.users.forEach((user, index) => {
      user.position = index;
    });
    this.gamestate = { ...dealGame(this.users), botGame: true };
    this.started = true;
    this.touch();
  }

  addUser(user) {
    if (!this.users.find(u => u.id === user.id)) {
      this.users.push(user);
    }
    this.touch();
  }

  removeUser(userId) {
    this.users = this.users.filter(u => u.id !== userId);
    this.touch();
  }
}

class LobbyManager {
  constructor() {
    // Keyed by the public lobby code
    this.lobbies = new Map();
  }

  createLobby(hostUser) {
    let lobby = new Lobby(hostUser);
    for (let i = 1; this.lobbies.has(lobby.code); i++) {
      if (i >= MAX_CODE_ATTEMPTS) throw new Error('Could not allocate a lobby code');
      lobby = new Lobby(hostUser);
    }
    this.lobbies.set(lobby.code, lobby);
    return lobby;
  }

  restoreLobby(row) {
    const lobby = new Lobby({ id: 'restored' });
    lobby.id = row.id;
    lobby.code = row.code;
    lobby.users = row.users || [];
    lobby.gamestate = row.gamestate && Object.keys(row.gamestate).length > 0 ? row.gamestate : null;
    lobby.createdAt = row.created_at;
    lobby.lastActivity = row.last_activity;
    lobby.started = !!row.started;
    this.lobbies.set(lobby.code, lobby);
    return lobby;
  }

  getLobby(code) {
    const key = normalizeLobbyCode(code);
    const lobby = this.lobbies.get(key);
    if (lobby?.isExpired()) {
      this.lobbies.delete(key);
      return undefined;
    }
    return lobby;
  }

  removeLobby(code) {
    this.lobbies.delete(normalizeLobbyCode(code));
  }

  removeExpired() {
    const removed = [];
    this.lobbies.forEach((lobby, code) => {
      if (lobby.isExpired()) {
        this.lobbies.delete(code);
        removed.push(code);
      }
    });
    return removed;
  }
}

function serializeLobby(lobby) {
  return {
    lobbyId: lobby.code,
    users: lobby.users,
    started: !!lobby.started,
    gamestate: lobby.gamestate || null
  };
}

async function saveLobbyToDb(lobby) {
  const pool = getPool();
  const now = new Date();
  await pool.query(
    `INSERT INTO lobbies (id, code, users, gamestate, created_at, updated_at, last_activity, started)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       users = EXCLUDED.users,
       gamestate = EXCLUDED.gamestate,
       updated_at = EXCLUDED.updated_at,
       last_activity = EXCLUDED.last_activity,
       started = EXCLUDED.started`,
    [
      lobby.id,
      lobby.code,
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

// Looks a lobby up by its public code; expired or malformed codes never match
async function loadLobbyFromDb(code) {
  const key = normalizeLobbyCode(code);
  if (!CODE_PATTERN.test(key)) return null;
  const pool = getPool();
  const res = await pool.query('SELECT * FROM lobbies WHERE code = $1', [key]);
  const row = res.rows[0];
  if (!row) return null;
  if (new Date() - new Date(row.last_activity) > CODE_TTL_MS) {
    await removeLobbyFromDb(row.id);
    return null;
  }
  return row;
}

// Creates a lobby and persists it, retrying if the generated code is already taken in the DB
async function createAndSaveLobby(manager, hostUser) {
  for (let attempt = 1; ; attempt++) {
    const lobby = manager.createLobby(hostUser);
    try {
      await saveLobbyToDb(lobby);
      return lobby;
    } catch (err) {
      manager.removeLobby(lobby.code);
      const codeTaken = err.code === '23505' && String(err.constraint || '').includes('code');
      if (!codeTaken || attempt >= MAX_CODE_ATTEMPTS) throw err;
    }
  }
}

async function cleanupInactiveLobbies(minutes = CODE_TTL_MINUTES) {
  const pool = getPool();
  const safeMinutes = Number(minutes) || CODE_TTL_MINUTES;
  await pool.query(
    "DELETE FROM lobbies WHERE last_activity < NOW() - make_interval(mins => $1)",
    [safeMinutes]
  );
}

module.exports = {
  MAX_PLAYERS,
  CODE_LENGTH,
  CODE_TTL_MINUTES,
  generateLobbyCode,
  Lobby,
  LobbyManager,
  serializeLobby,
  saveLobbyToDb,
  createAndSaveLobby,
  removeLobbyFromDb,
  loadLobbyFromDb,
  cleanupInactiveLobbies,
};

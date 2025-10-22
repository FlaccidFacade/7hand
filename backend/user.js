// user.js - Handles user creation and management

const { v4: uuidv4 } = require('uuid');
const { getPool } = require('./db');

class User {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.username = data.username;
    this.displayName = data.displayName || data.username;
    this.email = data.email || null;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.lastActive = data.lastActive || new Date();
    this.stats = data.stats || {
      gamesPlayed: 0,
      gamesWon: 0,
      gamesLost: 0
    };
  }

  /**
   * Validates user data
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validate() {
    const errors = [];

    if (!this.username || typeof this.username !== 'string') {
      errors.push('Username is required and must be a string');
    } else if (this.username.length < 3 || this.username.length > 20) {
      errors.push('Username must be between 3 and 20 characters');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(this.username)) {
      errors.push('Username can only contain letters, numbers, hyphens, and underscores');
    }

    if (this.displayName && this.displayName.length > 30) {
      errors.push('Display name must be 30 characters or less');
    }

    // Use a simpler email regex that's not vulnerable to ReDoS
    if (this.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(this.email)) {
      errors.push('Invalid email format');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Updates the last active timestamp
   */
  updateActivity() {
    this.lastActive = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Updates user stats
   * @param {Object} stats - Stats to update
   */
  updateStats(stats) {
    this.stats = { ...this.stats, ...stats };
    this.updatedAt = new Date();
  }

  /**
   * Converts user to a safe object (removes sensitive data)
   * @returns {Object}
   */
  toSafeObject() {
    return {
      id: this.id,
      username: this.username,
      displayName: this.displayName,
      stats: this.stats,
      createdAt: this.createdAt,
      lastActive: this.lastActive
    };
  }
}

class UserManager {
  constructor() {
    this.users = new Map();
  }

  /**
   * Creates a new user
   * @param {Object} userData - User data
   * @returns {User}
   */
  createUser(userData) {
    const user = new User(userData);
    const validation = user.validate();
    
    if (!validation.valid) {
      throw new Error(`User validation failed: ${validation.errors.join(', ')}`);
    }

    this.users.set(user.id, user);
    return user;
  }

  /**
   * Gets a user by ID
   * @param {string} userId
   * @returns {User|undefined}
   */
  getUser(userId) {
    return this.users.get(userId);
  }

  /**
   * Gets a user by username
   * @param {string} username
   * @returns {User|undefined}
   */
  getUserByUsername(username) {
    for (const user of this.users.values()) {
      if (user.username === username) {
        return user;
      }
    }
    return undefined;
  }

  /**
   * Updates a user
   * @param {string} userId
   * @param {Object} updates
   * @returns {User|null}
   */
  updateUser(userId, updates) {
    const user = this.users.get(userId);
    if (!user) return null;

    // Update allowed fields
    if (updates.displayName !== undefined) user.displayName = updates.displayName;
    if (updates.email !== undefined) user.email = updates.email;
    if (updates.stats !== undefined) user.updateStats(updates.stats);

    user.updatedAt = new Date();

    const validation = user.validate();
    if (!validation.valid) {
      throw new Error(`User validation failed: ${validation.errors.join(', ')}`);
    }

    return user;
  }

  /**
   * Removes a user
   * @param {string} userId
   */
  removeUser(userId) {
    this.users.delete(userId);
  }
}

/**
 * Saves a user to the database
 * @param {User} user
 */
async function saveUserToDb(user) {
  const pool = getPool();
  const now = new Date();
  await pool.query(
    `INSERT INTO users (id, username, display_name, email, created_at, updated_at, last_active, stats)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       username = EXCLUDED.username,
       display_name = EXCLUDED.display_name,
       email = EXCLUDED.email,
       updated_at = EXCLUDED.updated_at,
       last_active = EXCLUDED.last_active,
       stats = EXCLUDED.stats`,
    [
      user.id,
      user.username,
      user.displayName,
      user.email,
      user.createdAt || now,
      user.updatedAt || now,
      user.lastActive || now,
      JSON.stringify(user.stats)
    ]
  );
}

/**
 * Removes a user from the database
 * @param {string} userId
 */
async function removeUserFromDb(userId) {
  const pool = getPool();
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
}

/**
 * Loads a user from the database
 * @param {string} userId
 * @returns {Object|null}
 */
async function loadUserFromDb(userId) {
  const pool = getPool();
  const res = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  return res.rows[0] || null;
}

/**
 * Loads a user by username from the database
 * @param {string} username
 * @returns {Object|null}
 */
async function loadUserByUsernameFromDb(username) {
  const pool = getPool();
  const res = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  return res.rows[0] || null;
}

/**
 * Loads all users from the database
 * @returns {Array}
 */
async function loadAllUsersFromDb() {
  const pool = getPool();
  const res = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
  return res.rows;
}

/**
 * Updates user activity timestamp
 * @param {string} userId
 */
async function updateUserActivity(userId) {
  const pool = getPool();
  await pool.query(
    'UPDATE users SET last_active = $1, updated_at = $1 WHERE id = $2',
    [new Date(), userId]
  );
}

module.exports = {
  User,
  UserManager,
  saveUserToDb,
  removeUserFromDb,
  loadUserFromDb,
  loadUserByUsernameFromDb,
  loadAllUsersFromDb,
  updateUserActivity
};

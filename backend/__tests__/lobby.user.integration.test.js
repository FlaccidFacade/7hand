const request = require('supertest');
const express = require('express');
const { LobbyManager, saveLobbyToDb, removeLobbyFromDb } = require('../lobby');
const { UserManager, saveUserToDb, removeUserFromDb, loadUserFromDb, updateUserActivity } = require('../user');
const { connect, disconnect, getPool } = require('../db');
const logger = require('../logger');

// Create a test app
const app = express();
app.use(express.json());

const lobbyManager = new LobbyManager();
const userManager = new UserManager();

// User and lobby endpoints
app.post('/api/user', async (req, res) => {
  try {
    const user = userManager.createUser(req.body);
    await saveUserToDb(user);
    res.json(user.toSafeObject());
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/lobby', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID required' });
  
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
      coins: dbUser.coins,
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at,
      lastActive: dbUser.last_active,
      stats: dbUser.stats
    });
  }
  
  user.updateActivity();
  await updateUserActivity(userId);
  
  const lobby = lobbyManager.createLobby(user.toSafeObject());
  await saveLobbyToDb(lobby);
  res.json({ lobbyId: lobby.id, users: lobby.users });
});

app.post('/api/lobby/:lobbyId/join', async (req, res) => {
  const { userId } = req.body;
  const { lobbyId } = req.params;
  
  if (!userId) return res.status(400).json({ error: 'User ID required' });
  
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
      coins: dbUser.coins,
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at,
      lastActive: dbUser.last_active,
      stats: dbUser.stats
    });
  }
  
  user.updateActivity();
  await updateUserActivity(userId);
  
  const lobby = lobbyManager.getLobby(lobbyId);
  if (!lobby) return res.status(404).json({ error: 'Lobby not found' });
  
  lobby.addUser(user.toSafeObject());
  await saveLobbyToDb(lobby);
  res.json({ lobbyId: lobby.id, users: lobby.users });
});

describe('Lobby and User Integration', () => {
  beforeAll(async () => {
    await connect();
  });

  afterAll(async () => {
    await disconnect();
  });

  beforeEach(async () => {
    // Clean up
    const pool = getPool();
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM lobbies');
    userManager.users.clear();
    lobbyManager.lobbies.clear();
  });

  describe('POST /api/lobby with user integration', () => {
    it('should create lobby with valid user', async () => {
      // First create a user
      const userResponse = await request(app)
        .post('/api/user')
        .send({ username: 'testuser', displayName: 'Test User' });

      const userId = userResponse.body.id;

      // Create lobby with user ID
      const lobbyResponse = await request(app)
        .post('/api/lobby')
        .send({ userId });

      expect(lobbyResponse.status).toBe(200);
      expect(lobbyResponse.body.lobbyId).toBeDefined();
      expect(lobbyResponse.body.users).toHaveLength(1);
      expect(lobbyResponse.body.users[0].id).toBe(userId);
      expect(lobbyResponse.body.users[0].username).toBe('testuser');
    });

    it('should reject lobby creation without user ID', async () => {
      const response = await request(app)
        .post('/api/lobby')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('User ID required');
    });

    it('should reject lobby creation with non-existent user', async () => {
      const { v4: uuidv4 } = require('uuid');
      const response = await request(app)
        .post('/api/lobby')
        .send({ userId: uuidv4() });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });
  });

  describe('POST /api/lobby/:lobbyId/join with user integration', () => {
    it('should allow user to join lobby', async () => {
      // Create first user and lobby
      const user1Response = await request(app)
        .post('/api/user')
        .send({ username: 'user1', displayName: 'User 1' });

      const lobbyResponse = await request(app)
        .post('/api/lobby')
        .send({ userId: user1Response.body.id });

      const lobbyId = lobbyResponse.body.lobbyId;

      // Create second user
      const user2Response = await request(app)
        .post('/api/user')
        .send({ username: 'user2', displayName: 'User 2' });

      // Join lobby
      const joinResponse = await request(app)
        .post(`/api/lobby/${lobbyId}/join`)
        .send({ userId: user2Response.body.id });

      expect(joinResponse.status).toBe(200);
      expect(joinResponse.body.users).toHaveLength(2);
      expect(joinResponse.body.users[1].username).toBe('user2');
    });

    it('should reject join without user ID', async () => {
      const { v4: uuidv4 } = require('uuid');
      const response = await request(app)
        .post(`/api/lobby/${uuidv4()}/join`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('User ID required');
    });

    it('should reject join with non-existent user', async () => {
      const { v4: uuidv4 } = require('uuid');
      
      // Create user and lobby first
      const userResponse = await request(app)
        .post('/api/user')
        .send({ username: 'user1' });

      const lobbyResponse = await request(app)
        .post('/api/lobby')
        .send({ userId: userResponse.body.id });

      // Try to join with non-existent user
      const response = await request(app)
        .post(`/api/lobby/${lobbyResponse.body.lobbyId}/join`)
        .send({ userId: uuidv4() });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should reject join to non-existent lobby', async () => {
      const { v4: uuidv4 } = require('uuid');
      
      const userResponse = await request(app)
        .post('/api/user')
        .send({ username: 'user1' });

      const response = await request(app)
        .post(`/api/lobby/${uuidv4()}/join`)
        .send({ userId: userResponse.body.id });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Lobby not found');
    });
  });

  describe('User activity tracking through lobbies', () => {
    it('should update user activity when creating lobby', async () => {
      const userResponse = await request(app)
        .post('/api/user')
        .send({ username: 'testuser' });

      const userId = userResponse.body.id;
      const originalLastActive = userResponse.body.lastActive;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      await request(app)
        .post('/api/lobby')
        .send({ userId });

      // Check user activity was updated
      const pool = getPool();
      const result = await pool.query('SELECT last_active FROM users WHERE id = $1', [userId]);
      const updatedLastActive = result.rows[0].last_active;

      expect(new Date(updatedLastActive).getTime()).toBeGreaterThan(
        new Date(originalLastActive).getTime()
      );
    });
  });
});

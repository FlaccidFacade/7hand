const request = require('supertest');
const express = require('express');
const { UserManager, saveUserToDb, removeUserFromDb, loadUserFromDb } = require('../user');
const { connect, disconnect, getPool } = require('../db');
const logger = require('../logger');

// Create a test app
const app = express();
app.use(express.json());

const userManager = new UserManager();

// User endpoints (same as in index.js)
app.post('/api/user', async (req, res) => {
  try {
    const user = userManager.createUser(req.body);
    await saveUserToDb(user);
    logger.info(`User created: ${user.username} (${user.id})`);
    res.json(user.toSafeObject());
  } catch (error) {
    logger.error('Error creating user', error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/user/:userId', async (req, res) => {
  const { userId } = req.params;
  const user = userManager.getUser(userId);
  
  if (!user) {
    const dbUser = await loadUserFromDb(userId);
    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }
  }
  
  if (user) {
    res.json(user.toSafeObject());
  }
});

app.patch('/api/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = userManager.updateUser(userId, req.body);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await saveUserToDb(user);
    res.json(user.toSafeObject());
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/user/:userId', async (req, res) => {
  const { userId } = req.params;
  userManager.removeUser(userId);
  await removeUserFromDb(userId);
  res.json({ success: true });
});

describe('User API Endpoints', () => {
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
    userManager.users.clear();
  });

  describe('POST /api/user', () => {
    it('should create a new user', async () => {
      const response = await request(app)
        .post('/api/user')
        .send({
          username: 'testuser',
          displayName: 'Test User',
          email: 'test@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.username).toBe('testuser');
      expect(response.body.displayName).toBe('Test User');
      expect(response.body.id).toBeDefined();
      expect(response.body.email).toBeUndefined(); // Should not expose email
    });

    it('should reject invalid username', async () => {
      const response = await request(app)
        .post('/api/user')
        .send({
          username: 'ab' // too short
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('validation failed');
    });

    it('should reject user with invalid email', async () => {
      const response = await request(app)
        .post('/api/user')
        .send({
          username: 'testuser',
          email: 'invalid-email'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('validation failed');
    });
  });

  describe('GET /api/user/:userId', () => {
    it('should get user by ID', async () => {
      const createResponse = await request(app)
        .post('/api/user')
        .send({ username: 'testuser' });

      const userId = createResponse.body.id;

      const response = await request(app)
        .get(`/api/user/${userId}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(userId);
      expect(response.body.username).toBe('testuser');
    });

    it('should return 404 for non-existent user', async () => {
      const { v4: uuidv4 } = require('uuid');
      const response = await request(app)
        .get(`/api/user/${uuidv4()}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });
  });

  describe('PATCH /api/user/:userId', () => {
    it('should update user display name', async () => {
      const createResponse = await request(app)
        .post('/api/user')
        .send({ username: 'testuser' });

      const userId = createResponse.body.id;

      const response = await request(app)
        .patch(`/api/user/${userId}`)
        .send({ displayName: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.displayName).toBe('Updated Name');
      expect(response.body.username).toBe('testuser');
    });

    it('should update user stats', async () => {
      const createResponse = await request(app)
        .post('/api/user')
        .send({ username: 'testuser' });

      const userId = createResponse.body.id;

      const response = await request(app)
        .patch(`/api/user/${userId}`)
        .send({ stats: { gamesPlayed: 10, gamesWon: 5 } });

      expect(response.status).toBe(200);
      expect(response.body.stats.gamesPlayed).toBe(10);
      expect(response.body.stats.gamesWon).toBe(5);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .patch('/api/user/non-existent-id')
        .send({ displayName: 'Test' });

      expect(response.status).toBe(404);
    });

    it('should reject invalid updates', async () => {
      const createResponse = await request(app)
        .post('/api/user')
        .send({ username: 'testuser' });

      const userId = createResponse.body.id;

      const response = await request(app)
        .patch(`/api/user/${userId}`)
        .send({ displayName: 'a'.repeat(31) }); // too long

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/user/:userId', () => {
    it('should delete user', async () => {
      const createResponse = await request(app)
        .post('/api/user')
        .send({ username: 'testuser' });

      const userId = createResponse.body.id;

      const response = await request(app)
        .delete(`/api/user/${userId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify user is deleted
      const getResponse = await request(app)
        .get(`/api/user/${userId}`);

      expect(getResponse.status).toBe(404);
    });
  });
});

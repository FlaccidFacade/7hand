const request = require('supertest');

jest.mock('../user', () => ({
  loadUserByUsernameFromDb: jest.fn(),
  updateUserActivity: jest.fn()
}));

function createApp(mountPath = '/') {
  jest.resetModules();
  const express = require('express');
  const user = require('../user');
  const authRoutes = require('../routes/auth');
  const app = express();

  user.loadUserByUsernameFromDb.mockResolvedValue(null);
  authRoutes.setUserManager({ createUser: jest.fn() });
  app.use(express.json());
  app.use(mountPath, authRoutes);

  return { app, user };
}

describe('POST /login', () => {
  it('rejects requests missing credentials without querying users', async () => {
    const { app, user } = createApp();

    const response = await request(app)
      .post('/login')
      .send({ username: 'testuser' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Username and password are required');
    expect(user.loadUserByUsernameFromDb).not.toHaveBeenCalled();
  });

  it('returns a generic authentication error for an unknown user', async () => {
    const { app } = createApp();

    const response = await request(app)
      .post('/login')
      .send({ username: 'unknown', password: 'password' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid username or password');
  });

  it('limits the end-to-end login API to ten attempts per client', async () => {
    const { app, user } = createApp('/api/auth');

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'unknown', password: 'password' });

      expect(response.status).toBe(401);
      expect(response.headers['ratelimit-limit']).toBe('10');
    }

    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'unknown', password: 'password' });

    expect(response.status).toBe(429);
    expect(user.loadUserByUsernameFromDb).toHaveBeenCalledTimes(10);
  });
});

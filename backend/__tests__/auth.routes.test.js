const request = require('supertest');
const express = require('express');

const mockQuery = jest.fn();
jest.mock('../db', () => ({ getPool: () => ({ query: mockQuery }) }));
jest.mock('../user', () => ({
  loadUserByUsernameFromDb: jest.fn(),
  updateUserActivity: jest.fn().mockResolvedValue(undefined)
}));

const { LobbyManager } = require('../lobby');
const { loadUserByUsernameFromDb } = require('../user');
const authRoutes = require('../routes/auth');

describe('POST /api/auth/login lobby creation', () => {
  let app;
  let lobbyManager;
  let user;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] });
    lobbyManager = new LobbyManager();
    user = {
      id: 'u1',
      username: 'alice',
      updateActivity: jest.fn(),
      verifyPassword: jest.fn().mockResolvedValue(true),
      toSafeObject: () => ({ id: 'u1', username: 'alice', displayName: 'Alice' })
    };
    authRoutes.setUserManager({ createUser: jest.fn().mockReturnValue(user) });
    authRoutes.setLobbyManager(lobbyManager);
    loadUserByUsernameFromDb.mockResolvedValue({ id: 'u1', username: 'alice' });
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
  });

  it('should create, persist and return a lobby hosted by the user', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'alice', password: 'secret1' });
    expect(res.status).toBe(200);
    expect(res.body.lobby.users[0].id).toBe('u1');
    expect(res.body.lobby.started).toBe(false);
    expect(res.body.lobby.lobbyId).toMatch(/^[A-Z2-9]{6}$/);
    const lobby = lobbyManager.getLobby(res.body.lobby.lobbyId);
    expect(lobby).toBeDefined();
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][1].slice(0, 2)).toEqual([lobby.id, lobby.code]);
  });

  it('should not create a lobby when the password is invalid', async () => {
    user.verifyPassword.mockResolvedValue(false);
    const res = await request(app).post('/api/auth/login').send({ username: 'alice', password: 'wrong1' });
    expect(res.status).toBe(401);
    expect(res.body.lobby).toBeUndefined();
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

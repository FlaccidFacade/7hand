const request = require('supertest');
const express = require('express');

jest.mock('../lobby', () => {
  const actual = jest.requireActual('../lobby');
  return {
    ...actual,
    saveLobbyToDb: jest.fn().mockResolvedValue(undefined),
    removeLobbyFromDb: jest.fn().mockResolvedValue(undefined),
    loadLobbyFromDb: jest.fn().mockResolvedValue(null)
  };
});
jest.mock('../user', () => ({
  loadUserFromDb: jest.fn(),
  updateUserActivity: jest.fn()
}));

const { LobbyManager, saveLobbyToDb, loadLobbyFromDb } = require('../lobby');
const lobbyRoutes = require('../routes/lobby');

describe('lobby bot game routes', () => {
  let app;
  let lobbyManager;
  let lobby;

  beforeEach(() => {
    jest.clearAllMocks();
    lobbyManager = new LobbyManager();
    lobbyRoutes.setManagers(lobbyManager, {});
    app = express();
    app.use(express.json());
    app.use('/api/lobby', lobbyRoutes);
    lobby = lobbyManager.createLobby({ id: 'host', username: 'host', displayName: 'Host' });
  });

  it('should start a bot game for the host', async () => {
    const res = await request(app).post(`/api/lobby/${lobby.code}/start-bot-game`).send({ userId: 'host' });
    expect(res.status).toBe(200);
    expect(res.body.started).toBe(true);
    expect(res.body.users.length).toBe(6);
    expect(res.body.gamestate.hands.host.length).toBe(11);
    expect(saveLobbyToDb).toHaveBeenCalledWith(lobby);
  });

  it('should require a user id', async () => {
    const res = await request(app).post(`/api/lobby/${lobby.code}/start-bot-game`).send({});
    expect(res.status).toBe(400);
  });

  it('should return 404 for unknown lobby', async () => {
    const res = await request(app).post('/api/lobby/nope/start-bot-game').send({ userId: 'host' });
    expect(res.status).toBe(404);
  });

  it('should reject non-hosts', async () => {
    lobby.addUser({ id: 'guest' });
    const res = await request(app).post(`/api/lobby/${lobby.code}/start-bot-game`).send({ userId: 'guest' });
    expect(res.status).toBe(403);
  });

  it('should reject when other humans are seated', async () => {
    lobby.addUser({ id: 'guest' });
    const res = await request(app).post(`/api/lobby/${lobby.code}/start-bot-game`).send({ userId: 'host' });
    expect(res.status).toBe(409);
  });

  it('should reject starting twice', async () => {
    await request(app).post(`/api/lobby/${lobby.code}/start-bot-game`).send({ userId: 'host' });
    const res = await request(app).post(`/api/lobby/${lobby.code}/start-bot-game`).send({ userId: 'host' });
    expect(res.status).toBe(409);
  });

  it('should expose started and gamestate on GET', async () => {
    await request(app).post(`/api/lobby/${lobby.code}/start-bot-game`).send({ userId: 'host' });
    const res = await request(app).get(`/api/lobby/${lobby.code}`);
    expect(res.body.started).toBe(true);
    expect(res.body.gamestate.phase).toBe('playing');
  });

  it('should restore a lobby from the database on GET', async () => {
    loadLobbyFromDb.mockResolvedValueOnce({
      id: 'db-uuid',
      code: 'ABC234',
      users: [{ id: 'host' }],
      gamestate: {},
      started: false,
      created_at: new Date(),
      last_activity: new Date()
    });
    const res = await request(app).get('/api/lobby/abc234');
    expect(res.status).toBe(200);
    expect(res.body.lobbyId).toBe('ABC234');
    expect(lobbyManager.getLobby('ABC234')).toBeDefined();
  });

  it('should return the 6-character code as lobbyId and never the internal UUID', async () => {
    const res = await request(app).get(`/api/lobby/${lobby.code}`);
    expect(res.body.lobbyId).toMatch(/^[A-Z2-9]{6}$/);
    expect(JSON.stringify(res.body)).not.toContain(lobby.id);
  });

  it('should treat an expired lobby as not found', async () => {
    lobby.lastActivity = new Date(Date.now() - 31 * 60 * 1000);
    const res = await request(app).get(`/api/lobby/${lobby.code}`);
    expect(res.status).toBe(404);
  });

  it('should keep a lobby alive while it is being used', async () => {
    lobby.lastActivity = new Date(Date.now() - 29 * 60 * 1000);
    await request(app).get(`/api/lobby/${lobby.code}`);
    expect(Date.now() - lobby.lastActivity.getTime()).toBeLessThan(5000);
  });

  describe('PUT gamestate', () => {
    beforeEach(async () => {
      await request(app).post(`/api/lobby/${lobby.code}/start-bot-game`).send({ userId: 'host' });
      saveLobbyToDb.mockClear();
    });

    it('should save the game state for a member', async () => {
      const gamestate = { ...lobby.gamestate, handNumber: 2 };
      const res = await request(app).put(`/api/lobby/${lobby.code}/gamestate`).send({ userId: 'host', gamestate });
      expect(res.status).toBe(200);
      expect(lobby.gamestate.handNumber).toBe(2);
      expect(saveLobbyToDb).toHaveBeenCalled();
    });

    it('should reject non-members', async () => {
      const res = await request(app).put(`/api/lobby/${lobby.code}/gamestate`).send({ userId: 'stranger', gamestate: {} });
      expect(res.status).toBe(403);
    });

    it('should reject invalid game state', async () => {
      const res = await request(app).put(`/api/lobby/${lobby.code}/gamestate`).send({ userId: 'host', gamestate: [] });
      expect(res.status).toBe(400);
    });

    it('should reject when the game has not started', async () => {
      const other = lobbyManager.createLobby({ id: 'solo' });
      const res = await request(app).put(`/api/lobby/${other.code}/gamestate`).send({ userId: 'solo', gamestate: {} });
      expect(res.status).toBe(409);
    });
  });
});

const request = require('supertest');
const express = require('express');

jest.mock('../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
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
  loadUserFromDb: jest.fn().mockResolvedValue(null),
  updateUserActivity: jest.fn()
}));

const { LobbyManager, MAX_PLAYERS, saveLobbyToDb } = require('../lobby');
const lobbyRoutes = require('../routes/lobby');

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

function fakeUserManager() {
  const users = new Map();
  return {
    getUser: id => users.get(id),
    register(id) {
      users.set(id, {
        id,
        username: id,
        updateActivity() {},
        toSafeObject: () => ({ id, username: id, displayName: id.toUpperCase() })
      });
    }
  };
}

function setup(routes) {
  const lobbyManager = new LobbyManager();
  const userManager = fakeUserManager();
  routes.setManagers(lobbyManager, userManager);
  const app = express();
  app.use(express.json());
  app.use('/api/lobby', routes);
  const lobby = lobbyManager.createLobby({ id: 'host', username: 'host', displayName: 'HOST' });
  userManager.register('host');
  return { app, lobbyManager, userManager, lobby };
}

describe('multiplayer lobby routes', () => {
  let app;
  let lobbyManager;
  let userManager;
  let lobby;

  beforeEach(() => {
    jest.clearAllMocks();
    ({ app, lobbyManager, userManager, lobby } = setup(lobbyRoutes));
  });

  const join = (userId, code = lobby.code) => request(app).post(`/api/lobby/${code}/join`).send({ userId });
  const players = (...ids) => ids.forEach(id => userManager.register(id));
  const seat = async (...ids) => {
    players(...ids);
    for (const id of ids) {
      await join(id);
    }
  };

  describe('POST join', () => {
    it('should seat a newcomer in an open lobby', async () => {
      players('ann');
      const res = await join('ann');
      expect(res.status).toBe(200);
      expect(res.body.users.map(u => u.id)).toEqual(['host', 'ann']);
      expect(saveLobbyToDb).toHaveBeenCalledWith(lobby);
    });

    it('should let a member join again without a second seat', async () => {
      await seat('ann');
      const res = await join('ann');
      expect(res.status).toBe(200);
      expect(res.body.users.length).toBe(2);
    });

    it('should reject a newcomer once the game has started', async () => {
      await seat('ann');
      lobby.startGame();
      players('late');
      const res = await join('late');
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Game already started');
      expect(lobby.users.map(u => u.id)).toEqual(['host', 'ann']);
    });

    it('should let a member come back to a game that has started and return the game state', async () => {
      await seat('ann');
      lobby.startGame();
      const res = await join('ann');
      expect(res.status).toBe(200);
      expect(res.body.started).toBe(true);
      expect(res.body.gamestate.hands.ann.length).toBe(11);
    });

    it('should reject a newcomer when every seat is taken', async () => {
      const ids = Array.from({ length: MAX_PLAYERS - 1 }, (_, i) => `p${i}`);
      await seat(...ids);
      expect(lobby.users.length).toBe(MAX_PLAYERS);
      players('extra');
      const res = await join('extra');
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Lobby is full');
    });

    it('should let a member join again when the lobby is full', async () => {
      const ids = Array.from({ length: MAX_PLAYERS - 1 }, (_, i) => `p${i}`);
      await seat(...ids);
      const res = await join('p0');
      expect(res.status).toBe(200);
    });

    it('should answer 404 for an unknown lobby or user', async () => {
      players('ann');
      expect((await join('ann', 'ZZZZZZ')).status).toBe(404);
      expect((await join('nobody')).status).toBe(404);
    });

    it('should require a user id', async () => {
      const res = await request(app).post(`/api/lobby/${lobby.code}/join`).send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST start-game', () => {
    const start = (body, code = lobby.code) => request(app).post(`/api/lobby/${code}/start-game`).send(body);

    it('should deal a game to everyone in the lobby when the host starts it', async () => {
      await seat('ann', 'bo');
      saveLobbyToDb.mockClear();
      const res = await start({ userId: 'host' });
      expect(res.status).toBe(200);
      expect(res.body.started).toBe(true);
      expect(res.body.users.map(u => u.position)).toEqual([0, 1, 2]);
      expect(res.body.gamestate.botGame).toBe(false);
      expect(res.body.gamestate.turnOrder).toEqual(['host', 'ann', 'bo']);
      expect(saveLobbyToDb).toHaveBeenCalledWith(lobby);
    });

    it('should only seat the listed players plus the host', async () => {
      await seat('ann', 'bo', 'cy');
      const res = await start({ userId: 'host', playerIds: ['cy', 'ann'] });
      expect(res.status).toBe(200);
      expect(res.body.users.map(u => u.id)).toEqual(['host', 'ann', 'cy']);
      expect(Object.keys(res.body.gamestate.hands)).toEqual(['host', 'ann', 'cy']);
    });

    it('should require a user id', async () => {
      await seat('ann');
      expect((await start({})).status).toBe(400);
    });

    it('should reject a player list that is not a list of ids', async () => {
      await seat('ann');
      expect((await start({ userId: 'host', playerIds: 'ann' })).status).toBe(400);
      expect((await start({ userId: 'host', playerIds: [1] })).status).toBe(400);
      expect(lobby.started).toBe(false);
    });

    it('should answer 404 for an unknown lobby', async () => {
      expect((await start({ userId: 'host' }, 'ZZZZZZ')).status).toBe(404);
    });

    it('should reject anyone but the host', async () => {
      await seat('ann');
      const res = await start({ userId: 'ann' });
      expect(res.status).toBe(403);
      expect(lobby.started).toBe(false);
    });

    it('should reject a second start', async () => {
      await seat('ann');
      await start({ userId: 'host' });
      const res = await start({ userId: 'host' });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Game already started');
    });

    it('should need a second player', async () => {
      const res = await start({ userId: 'host' });
      expect(res.status).toBe(409);
      expect(lobby.started).toBe(false);
    });

    it('should need a second player after the list is applied', async () => {
      await seat('ann');
      const res = await start({ userId: 'host', playerIds: [] });
      expect(res.status).toBe(409);
      expect(lobby.users.length).toBe(2);
    });

    it('should accept saved game states from seated players afterwards', async () => {
      await seat('ann');
      const { body } = await start({ userId: 'host' });
      const res = await request(app)
        .put(`/api/lobby/${lobby.code}/gamestate`)
        .send({ userId: 'host', gamestate: { ...body.gamestate, handNumber: 2 } });
      expect(res.status).toBe(200);
      expect(lobby.gamestate.handNumber).toBe(2);
    });
  });

  describe('signaling relay', () => {
    const send = (message, code = lobby.code) => request(app).post(`/api/lobby/${code}/signal`).send(message);
    const poll = (userId, code = lobby.code) => request(app).get(`/api/lobby/${code}/signal/${userId}`);
    const offer = (extra = {}) => ({
      type: 'offer',
      from: 'ann',
      to: 'host',
      connectionId: 'abc123',
      payload: { type: 'offer', sdp: 'v=0' },
      ...extra
    });

    beforeEach(async () => {
      await seat('ann', 'bo');
    });

    it('should hand a queued message to its recipient exactly once', async () => {
      expect((await send(offer())).status).toBe(200);
      const first = await poll('host');
      expect(first.body).toEqual([offer()]);
      expect((await poll('host')).body).toEqual([]);
    });

    it('should deliver messages in the order they were sent and only to the recipient', async () => {
      await send(offer({ connectionId: '1' }));
      await send(offer({ connectionId: '2', to: 'bo' }));
      await send(offer({ connectionId: '3' }));
      expect((await poll('host')).body.map(m => m.connectionId)).toEqual(['1', '3']);
      expect((await poll('bo')).body.map(m => m.connectionId)).toEqual(['2']);
    });

    it('should relay answers and candidates and keep only the known fields', async () => {
      await send({ type: 'answer', from: 'ann', to: 'host', connectionId: 'c', payload: { sdp: 'x' }, extra: 'dropped' });
      await send({ type: 'ice-candidate', from: 'ann', to: 'host', connectionId: 'c', payload: [{ candidate: 'a' }] });
      const { body } = await poll('host');
      expect(body.map(m => m.type)).toEqual(['answer', 'ice-candidate']);
      expect(body[0]).toEqual({ type: 'answer', from: 'ann', to: 'host', connectionId: 'c', payload: { sdp: 'x' } });
    });

    it('should share queues between spellings of the lobby code', async () => {
      await send(offer(), lobby.code.toLowerCase());
      expect((await poll('host', lobby.code)).body.length).toBe(1);
      await send(offer(), lobby.code);
      expect((await poll('host', ` ${lobby.code.toLowerCase()}`.trim())).body.length).toBe(1);
    });

    it('should only relay peer-to-peer message types', async () => {
      for (const type of ['peer-joined', 'peer-left', 'chat', undefined]) {
        expect((await send(offer({ type }))).status).toBe(400);
      }
      expect((await poll('host')).body).toEqual([]);
    });

    it('should require string sender and recipient ids', async () => {
      expect((await send(offer({ from: undefined }))).status).toBe(400);
      expect((await send(offer({ to: { id: 'host' } }))).status).toBe(400);
      expect((await send(offer({ to: ['host'] }))).status).toBe(400);
    });

    it('should reject a request without a body', async () => {
      const res = await request(app).post(`/api/lobby/${lobby.code}/signal`);
      expect(res.status).toBe(400);
    });

    it('should answer 404 for an unknown lobby', async () => {
      expect((await send(offer(), 'ZZZZZZ')).status).toBe(404);
    });

    it('should reject messages from or to anyone outside the lobby', async () => {
      userManager.register('stranger');
      expect((await send(offer({ from: 'stranger' }))).status).toBe(403);
      expect((await send(offer({ to: 'stranger' }))).status).toBe(403);
      expect((await poll('stranger')).body).toEqual([]);
    });

    it('should keep only the newest 100 messages per recipient', async () => {
      for (let i = 0; i < 105; i++) {
        await send(offer({ connectionId: String(i) }));
      }
      const { body } = await poll('host');
      expect(body.length).toBe(100);
      expect(body[0].connectionId).toBe('5');
      expect(body[99].connectionId).toBe('104');
    });

    it('should return nothing for a lobby with no signaling yet', async () => {
      const other = lobbyManager.createLobby({ id: 'solo' });
      expect((await poll('solo', other.code)).body).toEqual([]);
    });

    it('should keep the lobby alive while its members poll', async () => {
      lobby.lastActivity = new Date(Date.now() - 29 * 60 * 1000);
      await poll('host');
      expect(Date.now() - lobby.lastActivity.getTime()).toBeLessThan(5000);
    });

    describe('notify-joined', () => {
      const notifyJoined = (userId, code = lobby.code) =>
        request(app).post(`/api/lobby/${code}/notify-joined`).send({ userId });

      it('should tell every other member but not the one who joined', async () => {
        expect((await notifyJoined('ann')).status).toBe(200);
        expect((await poll('host')).body).toEqual([{ type: 'peer-joined', from: 'ann', to: 'host' }]);
        expect((await poll('bo')).body).toEqual([{ type: 'peer-joined', from: 'ann', to: 'bo' }]);
        expect((await poll('ann')).body).toEqual([]);
      });

      it('should not queue anything for bots', async () => {
        lobby.users.push({ id: 'bot-1', isBot: true });
        await notifyJoined('ann');
        expect((await poll('bot-1')).body).toEqual([]);
      });

      it('should drop what was queued for the joiner on an earlier visit', async () => {
        await send(offer({ from: 'host', to: 'ann' }));
        await send(offer({ from: 'bo', to: 'ann' }));
        await notifyJoined('ann');
        expect((await poll('ann')).body).toEqual([]);
      });

      it('should keep messages queued for the others', async () => {
        await send(offer());
        await notifyJoined('ann');
        const { body } = await poll('host');
        expect(body.map(m => m.type)).toEqual(['offer', 'peer-joined']);
      });

      it('should work with any spelling of the lobby code', async () => {
        await notifyJoined('ann', lobby.code.toLowerCase());
        expect((await poll('host')).body.length).toBe(1);
      });

      it('should reject someone who is not in the lobby', async () => {
        userManager.register('stranger');
        expect((await notifyJoined('stranger')).status).toBe(403);
        expect((await poll('host')).body).toEqual([]);
      });

      it('should require a user id and an existing lobby', async () => {
        expect((await request(app).post(`/api/lobby/${lobby.code}/notify-joined`).send({})).status).toBe(400);
        expect((await notifyJoined('ann', 'ZZZZZZ')).status).toBe(404);
      });
    });

    describe('notify-left', () => {
      const notifyLeft = (userId, code = lobby.code) =>
        request(app).post(`/api/lobby/${code}/notify-left`).send({ userId });

      it('should tell every other member and drop the leaver queue', async () => {
        await send(offer({ from: 'host', to: 'ann' }));
        expect((await notifyLeft('ann')).status).toBe(200);
        expect((await poll('host')).body).toEqual([{ type: 'peer-left', from: 'ann', to: 'host' }]);
        expect((await poll('bo')).body).toEqual([{ type: 'peer-left', from: 'ann', to: 'bo' }]);
        expect((await poll('ann')).body).toEqual([]);
      });

      it('should still tell the others after the leaver was removed from the lobby', async () => {
        await request(app).post(`/api/lobby/${lobby.code}/leave`).send({ userId: 'ann' });
        await notifyLeft('ann');
        expect((await poll('host')).body).toEqual([{ type: 'peer-left', from: 'ann', to: 'host' }]);
      });

      it('should accept the notice for a lobby that no longer exists', async () => {
        expect((await notifyLeft('ann', 'ZZZZZZ')).status).toBe(200);
      });

      it('should require a string user id', async () => {
        expect((await request(app).post(`/api/lobby/${lobby.code}/notify-left`).send({})).status).toBe(400);
        expect((await notifyLeft({ id: 'ann' })).status).toBe(400);
      });
    });

    it('should forget the queues of a deleted lobby', async () => {
      await send(offer());
      await request(app).delete(`/api/lobby/${lobby.code}`);
      lobbyManager.restoreLobby({
        id: 'restored',
        code: lobby.code,
        users: [{ id: 'host' }, { id: 'ann' }],
        gamestate: {},
        started: false,
        created_at: new Date(),
        last_activity: new Date()
      });
      expect((await poll('host')).body).toEqual([]);
    });
  });
});

describe('signaling clean-up', () => {
  it('should drop the queues of lobbies that no longer exist and keep the others', async () => {
    const intervalSpy = jest.spyOn(global, 'setInterval').mockImplementation(() => ({ unref() {} }));
    let routes;
    jest.isolateModules(() => {
      routes = require('../routes/lobby');
    });
    const sweep = intervalSpy.mock.calls.find(([, ms]) => ms === SWEEP_INTERVAL_MS)[0];
    intervalSpy.mockRestore();

    const { app, lobbyManager, userManager, lobby } = setup(routes);
    userManager.register('ann');
    await request(app).post(`/api/lobby/${lobby.code}/join`).send({ userId: 'ann' });
    const live = lobbyManager.createLobby({ id: 'solo' });
    live.addUser({ id: 'pal' });

    const queue = (target, from, to) =>
      request(app).post(`/api/lobby/${target.code}/signal`).send({ type: 'offer', from, to });
    await queue(lobby, 'ann', 'host');
    await queue(live, 'pal', 'solo');

    lobby.lastActivity = new Date(Date.now() - 31 * 60 * 1000);
    sweep();

    lobbyManager.restoreLobby({
      id: 'restored',
      code: lobby.code,
      users: [{ id: 'host' }, { id: 'ann' }],
      gamestate: {},
      started: false,
      created_at: new Date(),
      last_activity: new Date()
    });
    const expired = await request(app).get(`/api/lobby/${lobby.code}/signal/host`);
    const kept = await request(app).get(`/api/lobby/${live.code}/signal/solo`);
    expect(expired.body).toEqual([]);
    expect(kept.body.length).toBe(1);
  });
});

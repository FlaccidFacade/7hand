const { LobbyManager, generateLobbyCode, saveLobbyToDb, createAndSaveLobby, loadLobbyFromDb, removeLobbyFromDb, cleanupInactiveLobbies } = require('../lobby');
const { connect, disconnect, getPool } = require('../db');
const { v4: uuidv4 } = require('uuid');

describe('Lobby DB Persistence', () => {
  beforeAll(async () => {
    await connect();
  });
  afterAll(async () => {
    await disconnect();
  });

  it('should save, load, and remove a lobby', async () => {
    const lobby = {
      id: uuidv4(),
      code: generateLobbyCode(),
      users: [{ id: 'user1' }],
      gamestate: { round: 1 },
      createdAt: new Date(),
      lastActivity: new Date(),
      started: false
    };
    await saveLobbyToDb(lobby);
    const loaded = await loadLobbyFromDb(lobby.code);
    expect(loaded).toBeTruthy();
    expect(loaded.id).toBe(lobby.id);
    expect(loaded.users[0].id).toBe('user1');
    await removeLobbyFromDb(lobby.id);
    const afterRemove = await loadLobbyFromDb(lobby.code);
    expect(afterRemove).toBeNull();
  });

  it('should cleanup inactive lobbies', async () => {
    const lobby = {
      id: uuidv4(),
      code: generateLobbyCode(),
      users: [{ id: 'user2' }],
      gamestate: {},
      createdAt: new Date(Date.now() - 31 * 60 * 1000),
      lastActivity: new Date(Date.now() - 31 * 60 * 1000),
      started: false
    };
    await saveLobbyToDb(lobby);
    await cleanupInactiveLobbies(30);
    const res = await getPool().query('SELECT 1 FROM lobbies WHERE id = $1', [lobby.id]);
    expect(res.rowCount).toBe(0);
  });

  it('should not load a lobby whose code has expired', async () => {
    const lobby = {
      id: uuidv4(),
      code: generateLobbyCode(),
      users: [{ id: 'user3' }],
      gamestate: {},
      createdAt: new Date(Date.now() - 31 * 60 * 1000),
      lastActivity: new Date(Date.now() - 31 * 60 * 1000),
      started: false
    };
    await saveLobbyToDb(lobby);
    expect(await loadLobbyFromDb(lobby.code)).toBeNull();
  });

  it('should retry with a new code when the generated one is already taken', async () => {
    const taken = { id: uuidv4(), code: generateLobbyCode(), users: [], gamestate: {}, started: false };
    await saveLobbyToDb(taken);
    const manager = new LobbyManager();
    const spy = jest.spyOn(manager, 'createLobby');
    const realCreate = LobbyManager.prototype.createLobby.bind(manager);
    spy.mockImplementationOnce((host) => {
      const lobby = realCreate(host);
      manager.lobbies.delete(lobby.code);
      lobby.code = taken.code;
      manager.lobbies.set(lobby.code, lobby);
      return lobby;
    });
    const lobby = await createAndSaveLobby(manager, { id: 'host' });
    expect(lobby.code).not.toBe(taken.code);
    expect(spy).toHaveBeenCalledTimes(2);
    await removeLobbyFromDb(taken.id);
    await removeLobbyFromDb(lobby.id);
  });
});

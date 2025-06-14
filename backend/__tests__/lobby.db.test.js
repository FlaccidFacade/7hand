const { saveLobbyToDb, loadLobbyFromDb, removeLobbyFromDb, cleanupInactiveLobbies } = require('../lobby');
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
      users: [{ id: 'user1' }],
      gamestate: { round: 1 },
      createdAt: new Date(),
      lastActivity: new Date(),
      started: false
    };
    await saveLobbyToDb(lobby);
    const loaded = await loadLobbyFromDb(lobby.id);
    expect(loaded).toBeTruthy();
    expect(loaded.id).toBe(lobby.id);
    expect(loaded.users[0].id).toBe('user1');
    await removeLobbyFromDb(lobby.id);
    const afterRemove = await loadLobbyFromDb(lobby.id);
    expect(afterRemove).toBeNull();
  });

  it('should cleanup inactive lobbies', async () => {
    const lobby = {
      id: uuidv4(),
      users: [{ id: 'user2' }],
      gamestate: {},
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      lastActivity: new Date(Date.now() - 3 * 60 * 60 * 1000),
      started: false
    };
    await saveLobbyToDb(lobby);
    await cleanupInactiveLobbies(2); // should remove lobbies inactive >2h
    const afterCleanup = await loadLobbyFromDb(lobby.id);
    expect(afterCleanup).toBeNull();
  });
});

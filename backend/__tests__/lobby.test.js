const { Lobby, LobbyManager, loadLobbyFromDb } = require('../lobby');

describe('Lobby', () => {
  it('should add and remove users', () => {
    const host = { id: 'host' };
    const user2 = { id: 'user2' };
    const lobby = new Lobby(host);
    expect(lobby.users.length).toBe(1);
    lobby.addUser(user2);
    expect(lobby.users.length).toBe(2);
    lobby.removeUser('user2');
    expect(lobby.users.length).toBe(1);
  });

  it('should not add duplicate users', () => {
    const host = { id: 'host' };
    const lobby = new Lobby(host);
    lobby.addUser(host);
    expect(lobby.users.length).toBe(1);
  });
});

describe('LobbyManager', () => {
  it('should create, get, and remove lobbies', () => {
    const manager = new LobbyManager();
    const host = { id: 'host' };
    const lobby = manager.createLobby(host);
    expect(manager.getLobby(lobby.code)).toBe(lobby);
    manager.removeLobby(lobby.code);
    expect(manager.getLobby(lobby.code)).toBeUndefined();
  });

  it('should give each lobby a 6-character code separate from its internal id', () => {
    const manager = new LobbyManager();
    const lobby = manager.createLobby({ id: 'host' });
    expect(lobby.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(lobby.code).not.toBe(lobby.id);
  });

  it('should look codes up case-insensitively', () => {
    const manager = new LobbyManager();
    const lobby = manager.createLobby({ id: 'host' });
    expect(manager.getLobby(` ${lobby.code.toLowerCase()} `)).toBe(lobby);
  });

  it('should expire lobbies after 30 minutes without activity', () => {
    const manager = new LobbyManager();
    const lobby = manager.createLobby({ id: 'host' });
    lobby.lastActivity = new Date(Date.now() - 29 * 60 * 1000);
    expect(manager.getLobby(lobby.code)).toBe(lobby);
    lobby.lastActivity = new Date(Date.now() - 31 * 60 * 1000);
    expect(manager.getLobby(lobby.code)).toBeUndefined();
    expect(manager.lobbies.size).toBe(0);
  });

  it('should sweep expired lobbies and keep active ones', () => {
    const manager = new LobbyManager();
    const stale = manager.createLobby({ id: 'a' });
    const fresh = manager.createLobby({ id: 'b' });
    stale.lastActivity = new Date(Date.now() - 31 * 60 * 1000);
    expect(manager.removeExpired()).toEqual([stale.code]);
    expect(manager.getLobby(fresh.code)).toBe(fresh);
  });
});

describe('Lobby bot game', () => {
  it('should fill seats with bots, deal cards and start', () => {
    const lobby = new Lobby({ id: 'host', username: 'host', displayName: 'Host' });
    lobby.startBotGame();
    expect(lobby.started).toBe(true);
    expect(lobby.users.length).toBe(6);
    expect(lobby.users.filter(u => u.isBot).length).toBe(5);
    expect(lobby.users.map(u => u.position)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(lobby.gamestate.botGame).toBe(true);
    expect(lobby.gamestate.currentTurn).toBe('host');
    expect(lobby.gamestate.hands.host.length).toBe(11);
  });

  it('should not start twice', () => {
    const lobby = new Lobby({ id: 'host' });
    lobby.startBotGame();
    expect(() => lobby.startBotGame()).toThrow('Game already started');
  });

  it('should restore a lobby from a db row', () => {
    const manager = new LobbyManager();
    const lobby = manager.restoreLobby({
      id: 'abc',
      code: 'ABC234',
      users: [{ id: 'u1' }],
      gamestate: {},
      started: true,
      created_at: new Date(),
      last_activity: new Date()
    });
    expect(manager.getLobby('ABC234')).toBe(lobby);
    expect(lobby.id).toBe('abc');
    expect(lobby.started).toBe(true);
    expect(lobby.gamestate).toBeNull();
  });
});

describe('loadLobbyFromDb', () => {
  it('should return null for codes that are not 6 valid characters without querying the database', async () => {
    await expect(loadLobbyFromDb('main')).resolves.toBeNull();
    await expect(loadLobbyFromDb('ABC10O')).resolves.toBeNull();
  });
});

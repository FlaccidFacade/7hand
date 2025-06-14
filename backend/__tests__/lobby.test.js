const { Lobby, LobbyManager } = require('../lobby');

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
    expect(manager.getLobby(lobby.id)).toBe(lobby);
    manager.removeLobby(lobby.id);
    expect(manager.getLobby(lobby.id)).toBeUndefined();
  });
});

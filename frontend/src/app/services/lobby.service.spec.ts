import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { LobbyService, Lobby, LobbyPlayer, GameState } from './lobby.service';

describe('LobbyService', () => {
  let service: LobbyService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [LobbyService]
    });
    service = TestBed.inject(LobbyService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should create a lobby', () => {
    const userId = 'test-user';
    const mockLobby: Lobby = {
      lobbyId: 'test-lobby-123',
      users: [{ id: userId, username: 'testuser', displayName: 'Test User' }]
    };

    service.createLobby(userId).subscribe(lobby => {
      expect(lobby).toEqual(mockLobby);
    });

    const req = httpMock.expectOne('/api/lobby');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userId });
    req.flush(mockLobby);
  });

  it('should join a lobby', () => {
    const lobbyId = 'test-lobby-123';
    const userId = 'test-user';
    const mockLobby: Lobby = {
      lobbyId,
      users: [
        { id: 'host-user', username: 'host', displayName: 'Host' },
        { id: userId, username: 'testuser', displayName: 'Test User' }
      ]
    };

    service.joinLobby(lobbyId, userId).subscribe(lobby => {
      expect(lobby).toEqual(mockLobby);
    });

    const req = httpMock.expectOne(`/api/lobby/${lobbyId}/join`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userId });
    req.flush(mockLobby);
  });

  it('should get lobby details', () => {
    const lobbyId = 'test-lobby-123';
    const mockLobby: Lobby = {
      lobbyId,
      users: [{ id: 'host-user', username: 'host', displayName: 'Host' }]
    };

    service.getLobby(lobbyId).subscribe(lobby => {
      expect(lobby).toEqual(mockLobby);
    });

    const req = httpMock.expectOne(`/api/lobby/${lobbyId}`);
    expect(req.request.method).toBe('GET');
    req.flush(mockLobby);
  });

  it('should leave lobby', () => {
    const lobbyId = 'test-lobby-123';
    const userId = 'test-user';

    service.leaveLobby(lobbyId, userId).subscribe(response => {
      expect(response.success).toBe(true);
    });

    const req = httpMock.expectOne(`/api/lobby/${lobbyId}/leave`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userId });
    req.flush({ success: true });
  });

  it('should delete lobby', () => {
    const lobbyId = 'test-lobby-123';

    service.deleteLobby(lobbyId).subscribe(response => {
      expect(response.success).toBe(true);
    });

    const req = httpMock.expectOne(`/api/lobby/${lobbyId}`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true });
  });

  it('should update game state', (done) => {
    const gameState: GameState = {
      players: [{ id: 'test-user', username: 'testuser', displayName: 'Test User' }],
      currentTurn: 'test-user'
    };

    service.getGameState().subscribe(state => {
      if (state) {
        expect(state).toEqual(gameState);
        done();
      }
    });

    service.updateGameState(gameState);
  });

  it('should add player to lobby', (done) => {
    const initialLobby: Lobby = {
      lobbyId: 'test-lobby',
      users: [{ id: 'user1', username: 'user1', displayName: 'User 1' }]
    };

    const newPlayer: LobbyPlayer = {
      id: 'user2',
      username: 'user2',
      displayName: 'User 2'
    };

    service.updateLobby(initialLobby);

    service.getCurrentLobby().subscribe(lobby => {
      if (lobby && lobby.users.length === 2) {
        expect(lobby.users).toContain(newPlayer);
        done();
      }
    });

    service.addPlayerToLobby(newPlayer);
  });

  it('should remove player from lobby', (done) => {
    const initialLobby: Lobby = {
      lobbyId: 'test-lobby',
      users: [
        { id: 'user1', username: 'user1', displayName: 'User 1' },
        { id: 'user2', username: 'user2', displayName: 'User 2' }
      ]
    };

    service.updateLobby(initialLobby);

    service.getCurrentLobby().subscribe(lobby => {
      if (lobby && lobby.users.length === 1) {
        expect(lobby.users.find(u => u.id === 'user2')).toBeUndefined();
        done();
      }
    });

    service.removePlayerFromLobby('user2');
  });

  it('should clear lobby', (done) => {
    const initialLobby: Lobby = {
      lobbyId: 'test-lobby',
      users: [{ id: 'user1', username: 'user1', displayName: 'User 1' }]
    };

    service.updateLobby(initialLobby);
    service.clearLobby();

    service.getCurrentLobby().subscribe(lobby => {
      if (lobby === null) {
        expect(lobby).toBeNull();
        done();
      }
    });
  });
});

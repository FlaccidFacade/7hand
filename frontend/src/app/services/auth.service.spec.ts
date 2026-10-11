import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { LobbyService } from './lobby.service';

describe('AuthService', () => {
  let service: AuthService;
  let lobbyService: LobbyService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(AuthService);
    lobbyService = TestBed.inject(LobbyService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should store the lobby returned by login', () => {
    const lobby = { lobbyId: 'lobby-1', users: [], started: false, gamestate: null };
    service.login({ username: 'alice', password: 'secret1' }).subscribe();
    httpMock.expectOne('/api/auth/login').flush({ success: true, user: { id: 'u1' }, lobby });

    let current: any;
    lobbyService.getCurrentLobby().subscribe(l => (current = l));
    expect(current).toEqual(lobby);
  });

  it('should clear the lobby on logout', () => {
    lobbyService.updateLobby({ lobbyId: 'lobby-1', users: [] });
    service.logout();

    let current: any = 'unset';
    lobbyService.getCurrentLobby().subscribe(l => (current = l));
    expect(current).toBeNull();
  });
});

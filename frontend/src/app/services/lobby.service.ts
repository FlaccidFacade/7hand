import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface LobbyPlayer {
  id: string;
  username: string;
  displayName: string;
  position?: number;
}

export interface Lobby {
  lobbyId: string;
  users: LobbyPlayer[];
  gamestate?: any;
  started?: boolean;
}

export interface GameState {
  currentTurn?: string;
  players: LobbyPlayer[];
  // Add more game state fields as needed
}

@Injectable({
  providedIn: 'root'
})
export class LobbyService {
  private currentLobby$ = new BehaviorSubject<Lobby | null>(null);
  private gameState$ = new BehaviorSubject<GameState | null>(null);

  constructor(private http: HttpClient) {}

  /**
   * Get current lobby as observable
   */
  getCurrentLobby(): Observable<Lobby | null> {
    return this.currentLobby$.asObservable();
  }

  /**
   * Get current game state as observable
   */
  getGameState(): Observable<GameState | null> {
    return this.gameState$.asObservable();
  }

  /**
   * Create a new lobby
   */
  createLobby(userId: string): Observable<Lobby> {
    return this.http.post<Lobby>('/api/lobby', { userId }).pipe(
      tap(lobby => this.currentLobby$.next(lobby))
    );
  }

  /**
   * Join an existing lobby
   */
  joinLobby(lobbyId: string, userId: string): Observable<Lobby> {
    return this.http.post<Lobby>(`/api/lobby/${lobbyId}/join`, { userId }).pipe(
      tap(lobby => this.currentLobby$.next(lobby))
    );
  }

  /**
   * Get lobby details
   */
  getLobby(lobbyId: string): Observable<Lobby> {
    return this.http.get<Lobby>(`/api/lobby/${lobbyId}`).pipe(
      tap(lobby => this.currentLobby$.next(lobby))
    );
  }

  /**
   * Leave lobby
   */
  leaveLobby(lobbyId: string, userId: string): Observable<any> {
    return this.http.post(`/api/lobby/${lobbyId}/leave`, { userId }).pipe(
      tap(() => this.currentLobby$.next(null))
    );
  }

  /**
   * Delete lobby (host only)
   */
  deleteLobby(lobbyId: string): Observable<any> {
    return this.http.delete(`/api/lobby/${lobbyId}`).pipe(
      tap(() => this.currentLobby$.next(null))
    );
  }

  /**
   * Update local game state
   */
  updateGameState(gameState: GameState): void {
    this.gameState$.next(gameState);
  }

  /**
   * Update local lobby state
   */
  updateLobby(lobby: Lobby): void {
    this.currentLobby$.next(lobby);
  }

  /**
   * Add player to local lobby state
   */
  addPlayerToLobby(player: LobbyPlayer): void {
    const currentLobby = this.currentLobby$.value;
    if (currentLobby) {
      const updatedLobby = {
        ...currentLobby,
        users: [...currentLobby.users, player]
      };
      this.currentLobby$.next(updatedLobby);
    }
  }

  /**
   * Remove player from local lobby state
   */
  removePlayerFromLobby(playerId: string): void {
    const currentLobby = this.currentLobby$.value;
    if (currentLobby) {
      const updatedLobby = {
        ...currentLobby,
        users: currentLobby.users.filter(u => u.id !== playerId)
      };
      this.currentLobby$.next(updatedLobby);
    }
  }

  /**
   * Clear current lobby
   */
  clearLobby(): void {
    this.currentLobby$.next(null);
    this.gameState$.next(null);
  }
}

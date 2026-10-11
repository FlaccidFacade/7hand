import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface LobbyPlayer {
  id: string;
  username: string;
  displayName: string;
  position?: number;
  isBot?: boolean;
}

export interface Lobby {
  lobbyId: string;
  users: LobbyPlayer[];
  gamestate?: GameState | null;
  started?: boolean;
}

export interface Card {
  id: string;
  suit: string;
  rank: string;
}

export interface Meld {
  id: string;
  type: 'set' | 'run';
  rank?: string;
  suit?: string;
  // Value of the first card of a run (A = 1 when low); an ace is 14 at the top end
  low?: number;
  cards: Card[];
}

export interface GameState {
  players?: LobbyPlayer[];
  phase?: string;
  botGame?: boolean;
  handNumber?: number;
  totalHands?: number;
  turnOrder?: string[];
  currentTurn?: string;
  turnPhase?: string;
  hands?: Record<string, Card[]>;
  drawPile?: Card[];
  discardPile?: Card[];
  scores?: Record<string, number>;
  // The table: one space per player holding the sets and runs that player has laid down
  board?: Record<string, Meld[]>;
  qualified?: Record<string, boolean>;
  winnerId?: string;
  startedAt?: string;
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
      tap(lobby => this.applyLobby(lobby))
    );
  }

  /**
   * Join an existing lobby
   */
  joinLobby(lobbyId: string, userId: string): Observable<Lobby> {
    return this.http.post<Lobby>(`/api/lobby/${lobbyId}/join`, { userId }).pipe(
      tap(lobby => this.applyLobby(lobby))
    );
  }

  /**
   * Get lobby details
   */
  getLobby(lobbyId: string): Observable<Lobby> {
    return this.http.get<Lobby>(`/api/lobby/${lobbyId}`).pipe(
      tap(lobby => this.applyLobby(lobby))
    );
  }

  /**
   * Start a game against computer players. The server seats the bots,
   * deals the cards and returns the started lobby.
   */
  startBotGame(lobbyId: string, userId: string): Observable<Lobby> {
    return this.http.post<Lobby>(`/api/lobby/${lobbyId}/start-bot-game`, { userId }).pipe(
      tap(lobby => this.applyLobby(lobby))
    );
  }

  /**
   * Persist the current game state on the server (periodic save)
   */
  saveGameState(lobbyId: string, userId: string, gamestate: GameState): Observable<any> {
    return this.http.put(`/api/lobby/${lobbyId}/gamestate`, { userId, gamestate });
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
    this.applyLobby(lobby);
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

  private applyLobby(lobby: Lobby): void {
    this.currentLobby$.next(lobby);
    if (lobby.gamestate) {
      this.gameState$.next(lobby.gamestate);
    }
  }
}

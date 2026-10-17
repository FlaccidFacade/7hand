import { Injectable, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { GameMove, applyMove, parseMove, startNextHand } from './game-logic';
import { GameState, LobbyService } from './lobby.service';
import { WebRTCService } from './webrtc.service';

/**
 * Keeps a peer-to-peer game consistent. The host holds the authoritative state: players send
 * their intended move to the host, which validates it and broadcasts the result. Guests only
 * accept state that comes from the host's own connection.
 */
@Injectable({ providedIn: 'root' })
export class GameSyncService implements OnDestroy {
  private readonly webrtc = inject(WebRTCService);
  private readonly lobbyService = inject(LobbyService);

  private hostId: string | null = null;
  private myId: string | null = null;
  private state: GameState | null = null;
  private subscriptions: Subscription[] = [];

  /** Starts syncing; `hostId` is the lobby host's user id. */
  start(myId: string, hostId: string): void {
    this.stop();
    this.myId = myId;
    this.hostId = hostId;
    this.subscriptions = [
      this.lobbyService.getGameState().subscribe(state => (this.state = state)),
      this.webrtc.dataChannelMessage$.subscribe(message => this.onMessage(message.from, message.type, message.data)),
      this.webrtc.peerConnected$.subscribe(peerId => {
        if (this.isHost && this.state && !this.state.botGame) {
          this.webrtc.sendToPeer(peerId, 'gameState', this.state);
        }
      })
    ];
  }

  stop(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
    this.myId = null;
    this.hostId = null;
    this.state = null;
  }

  get isHost(): boolean {
    return !!this.myId && this.myId === this.hostId;
  }

  /** Plays a move: the host applies it directly, a guest asks the host. Throws if the host's own move is illegal. */
  submit(move: GameMove): void {
    if (!this.myId || !this.hostId || !this.state) {
      throw new Error('No game in progress');
    }
    if (this.isHost) {
      this.commit(applyMove(this.state, this.myId, move));
    } else if (!this.webrtc.sendToPeer(this.hostId, 'move', move)) {
      throw new Error('Not connected to the host');
    }
  }

  /** Host only: deals the next hand and shares it. */
  dealNextHand(): void {
    if (!this.isHost || !this.state) {
      throw new Error('Only the host can deal the next hand');
    }
    this.commit(startNextHand(this.state));
  }

  private commit(next: GameState): void {
    this.state = next;
    this.lobbyService.updateGameState(next);
    this.webrtc.broadcast('gameState', next);
  }

  private onMessage(from: string, type: string, data: unknown): void {
    if (type === 'move' && this.isHost && this.state && !this.state.botGame) {
      const move = parseMove(data);
      if (!move) {
        return;
      }
      try {
        // `from` is the verified connection, never a field in the payload
        this.commit(applyMove(this.state, from, move));
      } catch (error) {
        this.webrtc.sendToPeer(from, 'moveRejected', {
          message: error instanceof Error ? error.message : 'Move rejected'
        });
      }
    } else if (type === 'gameState' && !this.isHost && from === this.hostId && data && typeof data === 'object') {
      this.state = data as GameState;
      this.lobbyService.updateGameState(this.state);
    }
  }

  ngOnDestroy(): void {
    this.stop();
  }
}

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { User } from '../../services/user.service';
import { HeaderComponent } from '../header/header.component';
import { LobbyService, LobbyPlayer } from '../../services/lobby.service';
import { WebRTCService } from '../../services/webrtc.service';
import { SignalingService } from '../../services/signaling.service';
import { Subscription } from 'rxjs';

interface Player {
  id: string;
  username: string;
  displayName: string;
  position: number;
}

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [CommonModule, HeaderComponent],
  templateUrl: './lobby.html',
  styleUrls: ['./lobby.css']
})
export class Lobby implements OnInit, OnDestroy {
  userCoins = 0;
  lobbyId: string | null = null;
  players: Player[] = [];
  maxPlayers = 6;
  isHost = false;
  currentUserId: string | null = null;
  currentUser: User | null = null;
  
  showProfileModal = false;
  showRulesModal = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private lobbyService: LobbyService,
    private webrtcService: WebRTCService,
    private signalingService: SignalingService
  ) {}

  ngOnInit(): void {
    this.lobbyId = this.route.snapshot.paramMap.get('id');
    this.loadCurrentUser();
    this.loadLobby();
    this.setupP2PConnections();
    this.setupEventListeners();
  }

  ngOnDestroy(): void {
    // Cleanup P2P connections
    this.cleanup();
  }

  private setupEventListeners(): void {
    // Listen for peer joined events
    const peerJoinedSub = this.signalingService.peerJoined$.subscribe((peerId) => {
      console.log('Peer joined:', peerId);
      // Peer will be added through lobby service updates
    });

    // Listen for peer left events
    const peerLeftSub = this.signalingService.peerLeft$.subscribe((peerId) => {
      console.log('Peer left:', peerId);
      this.lobbyService.removePlayerFromLobby(peerId);
    });

    // Listen for data channel messages
    const dataChannelSub = this.webrtcService.dataChannelMessage$.subscribe((message) => {
      this.handleP2PMessage(message);
    });

    // Listen for lobby updates
    const lobbySub = this.lobbyService.getCurrentLobby().subscribe((lobby) => {
      if (lobby) {
        this.players = lobby.users.map((user, index) => ({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          position: user.position ?? index
        }));
        this.isHost = this.currentUserId === this.players[0]?.id;
      }
    });

    this.subscriptions.push(peerJoinedSub, peerLeftSub, dataChannelSub, lobbySub);
  }

  private async setupP2PConnections(): Promise<void> {
    if (!this.lobbyId || !this.currentUserId) {
      return;
    }

    try {
      // Initialize signaling for this lobby
      await this.signalingService.initializeForLobby(this.lobbyId, this.currentUserId);
      
      // Notify other users that we joined
      await this.signalingService.notifyJoined(this.lobbyId, this.currentUserId).toPromise();
    } catch (error) {
      console.error('Error setting up P2P connections:', error);
    }
  }

  private handleP2PMessage(message: any): void {
    console.log('Received P2P message:', message);
    
    // Handle different message types
    switch (message.type) {
      case 'gameState':
        // Update game state from peer
        if (message.data) {
          this.lobbyService.updateGameState(message.data);
        }
        break;
      case 'playerAction':
        // Handle player action
        console.log('Player action:', message.data);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private cleanup(): void {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    
    // Notify others we're leaving
    if (this.lobbyId && this.currentUserId) {
      this.signalingService.notifyLeft(this.lobbyId, this.currentUserId).subscribe();
    }
    
    // Clean up signaling
    this.signalingService.cleanup();
    
    // Close all WebRTC connections
    this.webrtcService.closeAllConnections();
  }

  loadCurrentUser(): void {
    const userJson = localStorage.getItem('currentUser');
    if (userJson) {
      this.currentUser = JSON.parse(userJson);
      this.currentUserId = this.currentUser!.id;
      this.userCoins = this.currentUser?.coins ?? 0;
    }
  }

  loadLobby(): void {
    if (!this.lobbyId) {
      return;
    }

    // Load lobby data from API
    this.lobbyService.getLobby(this.lobbyId).subscribe({
      next: (lobby) => {
        console.log('Lobby loaded:', lobby);
      },
      error: (error) => {
        console.error('Error loading lobby:', error);
      }
    });
  }

  getPlayerAtPosition(position: number): Player | null {
    return this.players.find(p => p.position === position) || null;
  }

  isPositionOccupied(position: number): boolean {
    return this.players.some(p => p.position === position);
  }

  getEmptySeats(): number[] {
    const occupied = new Set(this.players.map(p => p.position));
    return Array.from({ length: this.maxPlayers }, (_, i) => i)
      .filter(i => !occupied.has(i));
  }

  leaveLobby(): void {
    if (this.lobbyId && this.currentUserId) {
      this.lobbyService.leaveLobby(this.lobbyId, this.currentUserId).subscribe({
        next: () => {
          this.cleanup();
          this.router.navigate(['/']);
        },
        error: (error) => {
          console.error('Error leaving lobby:', error);
        }
      });
    }
  }

  startGame(): void {
    if (this.isHost && this.players.length >= 2) {
      console.log('Starting game...');
      
      // Broadcast game start to all peers via P2P
      this.webrtcService.broadcast('gameStart', {
        players: this.players,
        timestamp: Date.now()
      });
      
      // Navigate to game or update state
      // TODO: Implement game start logic
    }
  }

  copyLobbyLink(): void {
    const link = `${globalThis.location.origin}/lobby/${this.lobbyId}`;
    navigator.clipboard.writeText(link).then(() => {
      console.log('Lobby link copied!');
    });
  }

 
}

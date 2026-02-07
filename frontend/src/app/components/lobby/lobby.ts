import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { User } from '../../services/user.service';
import { HeaderComponent } from '../header/header.component';

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

  constructor(
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.lobbyId = this.route.snapshot.paramMap.get('id');
    this.loadCurrentUser();
    this.loadLobby();
  }

  ngOnDestroy(): void {
    // Cleanup if needed
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
    // Load lobby data from API
    // For now, mock some players
    this.players = [
      { id: this.currentUserId || '1', username: this.currentUser?.username || 'player1', displayName: this.currentUser?.displayName || 'Player 1', position: 0 },
     
    ];
    this.isHost = this.currentUserId === this.players[0]?.id;
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
    //TODO
  }

  startGame(): void {
    if (this.isHost && this.players.length >= 2) {
      // TODO: Start game logic
      console.log('Starting game...');
    }
  }

  copyLobbyLink(): void {
    const link = `${globalThis.location.origin}/lobby/${this.lobbyId}`;
    navigator.clipboard.writeText(link).then(() => {
      console.log('Lobby link copied!');
    });
  }

 
}

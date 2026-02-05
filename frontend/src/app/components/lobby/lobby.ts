import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { UserProfile } from '../user-profile/user-profile';
import { RulesDisplay } from '../rules-display/rules-display';
import { Modal } from '../modal/modal';
import { User } from '../../services/user.service';

interface Player {
  id: string;
  username: string;
  displayName: string;
  position: number;
}

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [CommonModule, UserProfile, RulesDisplay, Modal],
  templateUrl: './lobby.html',
  styleUrl: './lobby.css'
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
    private route: ActivatedRoute,
    private router: Router
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
    // TODO: Load lobby data from API
    // For now, mock some players
    this.players = [
      { id: '1', username: 'player1', displayName: 'Player 1', position: 0 },
      { id: '2', username: 'player2', displayName: 'Player 2', position: 2 },
      { id: '3', username: 'player3', displayName: 'Player 3', position: 4 }
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
    const occupied = this.players.map(p => p.position);
    return Array.from({ length: this.maxPlayers }, (_, i) => i)
      .filter(i => !occupied.includes(i));
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
    const link = `${window.location.origin}/lobby/${this.lobbyId}`;
    navigator.clipboard.writeText(link).then(() => {
      console.log('Lobby link copied!');
    });
  }

  openProfileModal(): void {
    this.showProfileModal = true;
  }

  closeProfileModal(): void {
    this.showProfileModal = false;
  }

  openRulesModal(): void {
    this.showRulesModal = true;
  }

  closeRulesModal(): void {
    this.showRulesModal = false;
  }

  handleLogout(): void {
    localStorage.removeItem('currentUser');
    this.router.navigate(['/register']);
  }
}

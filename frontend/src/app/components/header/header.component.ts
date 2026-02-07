import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

import { User } from '../../services/user.service';
import { Modal } from '../modal/modal';
import { RulesDisplay } from '../rules-display/rules-display';
import { UserProfile } from '../user-profile/user-profile';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [ CommonModule, UserProfile, RulesDisplay, Modal],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent {
  userCoins = 0;
  showProfileModal = false;
  showRulesModal = false;

  currentUserId: string | null = null;
  currentUser: User | null = null;

  constructor(
    private router: Router
  ) {}

  openProfileModal(): void {
    this.showProfileModal = true;
  }
  
  ngOnInit(): void {
    this.loadCurrentUser();
  }

 loadCurrentUser(): void {
    const userJson = localStorage.getItem('currentUser');
    if (userJson) {
      this.currentUser = JSON.parse(userJson);
      this.currentUserId = this.currentUser!.id;
      this.userCoins = this.currentUser?.coins ?? 0;
    }
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

  logout(): void {
    localStorage.removeItem('currentUser');
    this.router.navigate(['/register']);
  }
}

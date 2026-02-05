import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { User } from '../../services/user.service';
import { CookieService } from '../../services/cookie.service';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.css'
})
export class UserProfile implements OnInit {
  @Input() user: User | null = null;
  @Output() logout = new EventEmitter<void>();
  
  preferences = {
    essential: true,
    analytics: false,
    advertising: false,
    personalized: false
  };

  constructor(private cookieService: CookieService) {}

  ngOnInit(): void {
    this.loadPreferences();
  }

  loadPreferences(): void {
    const consent = localStorage.getItem('cookieConsent');
    if (consent) {
      try {
        const consentData = JSON.parse(consent);
        if (consentData.preferences) {
          this.preferences = { ...this.preferences, ...consentData.preferences };
        }
      } catch (e) {
        console.error('Error loading cookie preferences:', e);
      }
    }
  }

  togglePreference(type: 'analytics' | 'advertising' | 'personalized'): void {
    this.preferences[type] = !this.preferences[type];
    this.savePreferences();
  }

  savePreferences(): void {
    const consentData = {
      timestamp: new Date().toISOString(),
      preferences: this.preferences
    };
    localStorage.setItem('cookieConsent', JSON.stringify(consentData));
  }

  onLogout(): void {
    this.logout.emit();
  }

  getWinRate(): number {
    if (!this.user || this.user.stats.gamesPlayed === 0) {
      return 0;
    }
    return Math.round((this.user.stats.gamesWon / this.user.stats.gamesPlayed) * 100);
  }
}

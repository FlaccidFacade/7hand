import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-cookie-consent',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cookie-consent.html',
  styleUrl: './cookie-consent.css'
})
export class CookieConsent implements OnInit {
  showBanner = false;
  showSettings = false;

  preferences = {
    essential: true, // Always true, cannot be disabled
    analytics: false,
    advertising: false,
    personalized: false
  };

  ngOnInit() {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      this.showBanner = true;
    }
  }

  acceptAll() {
    this.preferences = {
      essential: true,
      analytics: true,
      advertising: true,
      personalized: true
    };
    this.saveConsent();
  }

  rejectAll() {
    this.preferences = {
      essential: true,
      analytics: false,
      advertising: false,
      personalized: false
    };
    this.saveConsent();
  }

  openSettings() {
    this.showSettings = true;
  }

  closeSettings() {
    this.showSettings = false;
  }

  savePreferences() {
    this.saveConsent();
  }

  private saveConsent() {
    const consentData = {
      timestamp: new Date().toISOString(),
      preferences: this.preferences
    };
    localStorage.setItem('cookieConsent', JSON.stringify(consentData));
    this.showBanner = false;
    this.showSettings = false;
    
    // Apply consent preferences
    this.applyConsent();
  }

  private applyConsent() {
    // Here you would disable/enable tracking scripts based on preferences
    if (!this.preferences.analytics) {
      // Disable analytics tracking
      console.log('Analytics disabled');
    }
    if (!this.preferences.advertising) {
      // Disable advertising cookies
      console.log('Advertising disabled');
    }
    if (!this.preferences.personalized) {
      // Disable personalized ads
      console.log('Personalized ads disabled');
    }
  }
}

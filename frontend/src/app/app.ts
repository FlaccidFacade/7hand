import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HealthService } from './services/health.service';
import { CookieConsent } from './components/cookie-consent/cookie-consent';
import { GoogleAdsense } from './components/google-adsense/google-adsense';
import { AdsenseService } from './services/adsense.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CookieConsent, CommonModule, GoogleAdsense],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected title = 'card-game-frontend';
  protected health$ = inject(HealthService).getHealth();
  protected adsenseService = inject(AdsenseService);
  public showLogin = true; // Flag to show login or game content
  public showRulesOverlay = false; // Flag to show rules overlay

  showRules = () => {
    this.showRulesOverlay = true;
  }

  hideRules = () => {
    this.showRulesOverlay = false;
  }
}

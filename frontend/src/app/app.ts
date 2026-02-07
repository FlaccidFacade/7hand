import { Component, inject, ViewChild, AfterViewInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HealthService } from './services/health.service';
import { CookieConsent } from './components/cookie-consent/cookie-consent';
import { GoogleAdsense } from './components/google-adsense/google-adsense';
import { MobilePopupAd } from './components/mobile-popup-ad/mobile-popup-ad';
import { AdsenseService } from './services/adsense.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CookieConsent, CommonModule, GoogleAdsense, MobilePopupAd],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App implements AfterViewInit {
  @ViewChild(MobilePopupAd) mobilePopupAd?: MobilePopupAd;
  
  protected title = 'card-game-frontend';
  protected health$ = inject(HealthService).getHealth();
  protected adsenseService = inject(AdsenseService);
  public showLogin = true; // Flag to show login or game content
  public showRulesOverlay = false; // Flag to show rules overlay

  ngAfterViewInit(): void {
    // Make popup component accessible from console for debugging
    if (this.mobilePopupAd) {
      (window as any).mobilePopupAd = this.mobilePopupAd;
      console.log('[App] Mobile popup ad component available in console as window.mobilePopupAd');
      console.log('[App] Test commands:');
      console.log('  - window.mobilePopupAd.forceShowPopup() - Force show the popup');
      console.log('  - window.mobilePopupAd.resetSession() - Reset session flag');
      console.log('  - sessionStorage.removeItem("mobilePopupShown") - Clear session storage');
    }
  }

  showRules = () => {
    this.showRulesOverlay = true;
  }

  hideRules = () => {
    this.showRulesOverlay = false;
  }
}

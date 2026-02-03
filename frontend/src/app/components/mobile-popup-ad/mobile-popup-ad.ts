import { Component, OnInit, OnDestroy, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { GoogleAdsense } from '../google-adsense/google-adsense';
import { AdsenseService } from '../../services/adsense.service';

@Component({
  selector: 'mobile-popup-ad',
  standalone: true,
  imports: [CommonModule, GoogleAdsense],
  templateUrl: './mobile-popup-ad.html',
  styleUrl: './mobile-popup-ad.css'
})
export class MobilePopupAd implements OnInit, OnDestroy {
  showPopup = false;
  private popupShown = false;
  private popupTimeout?: number;
  private resizeListener?: () => void;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    public adsenseService: AdsenseService
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      console.log('[MobilePopupAd] Component initialized');
      console.log('[MobilePopupAd] Window width:', window.innerWidth);
      
      // Delay initial check slightly to ensure DOM is ready
      setTimeout(() => {
        this.checkAndShowPopup();
      }, 100);
      
      // Listen for window resize to handle orientation changes
      this.resizeListener = () => this.checkAndShowPopup();
      window.addEventListener('resize', this.resizeListener);
    }
  }

  ngOnDestroy(): void {
    if (this.popupTimeout) {
      clearTimeout(this.popupTimeout);
    }
    if (this.resizeListener && isPlatformBrowser(this.platformId)) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }

  /**
   * Check if popup should be shown based on screen size and consent
   */
  private checkAndShowPopup(): void {
    console.log('[MobilePopupAd] Checking if popup should show...');
    console.log('[MobilePopupAd] Already shown?', this.popupShown);
    console.log('[MobilePopupAd] Can show ad?', this.canShowAd());
    
    if (this.popupShown) {
      console.log('[MobilePopupAd] Popup already shown this instance');
      return;
    }
    
    if (!this.canShowAd()) {
      console.log('[MobilePopupAd] Cannot show ad (check consent/session)');
      return;
    }

    // Only show on mobile/tablet screens (< 1024px)
    const width = window.innerWidth;
    console.log('[MobilePopupAd] Current width:', width);
    
    if (width < 1024) {
      console.log('[MobilePopupAd] Mobile detected! Will show popup in 5 seconds...');
      // Show popup after a delay to avoid being intrusive
      this.popupTimeout = window.setTimeout(() => {
        console.log('[MobilePopupAd] Showing popup now!');
        this.showPopup = true;
        this.popupShown = true;
        this.markPopupShown();
      }, 5000); // Show after 5 seconds
    } else {
      console.log('[MobilePopupAd] Desktop detected, skipping popup');
    }
  }

  /**
   * Check if ad can be shown based on cookie consent
   */
  private canShowAd(): boolean {
    try {
      const consent = localStorage.getItem('cookieConsent');
      console.log('[MobilePopupAd] Cookie consent data:', consent);
      
      if (!consent) {
        console.log('[MobilePopupAd] No cookie consent found');
        return false;
      }

      const consentData = JSON.parse(consent);
      console.log('[MobilePopupAd] Parsed consent:', consentData);
      console.log('[MobilePopupAd] Advertising enabled?', consentData.preferences?.advertising);
      
      if (consentData.preferences?.advertising !== true) {
        console.log('[MobilePopupAd] Advertising not consented');
        return false;
      }

      // Check if popup was shown recently (don't show more than once per session)
      const popupShown = sessionStorage.getItem('mobilePopupShown');
      console.log('[MobilePopupAd] Session storage check:', popupShown);
      
      if (popupShown) {
        console.log('[MobilePopupAd] Popup already shown this session');
        return false;
      }
      
      console.log('[MobilePopupAd] All checks passed! Can show ad.');
      return true;
    } catch (error) {
      console.error('[MobilePopupAd] Error checking ad consent:', error);
      return false;
    }
  }

  /**
   * Mark popup as shown in session storage
   */
  private markPopupShown(): void {
    try {
      sessionStorage.setItem('mobilePopupShown', 'true');
    } catch (error) {
      console.error('Error marking popup as shown:', error);
    }
  }

  /**
   * Close the popup
   */
  closePopup(): void {
    this.showPopup = false;
  }

  /**
   * Force show popup for testing (call from console)
   */
  forceShowPopup(): void {
    console.log('[MobilePopupAd] Force showing popup for testing');
    this.showPopup = true;
  }

  /**
   * Reset session flag for testing
   */
  resetSession(): void {
    console.log('[MobilePopupAd] Resetting session flag');
    sessionStorage.removeItem('mobilePopupShown');
    this.popupShown = false;
  }

  /**
   * Close popup when clicking outside the ad area
   */
  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('popup-backdrop')) {
      this.closePopup();
    }
  }
}

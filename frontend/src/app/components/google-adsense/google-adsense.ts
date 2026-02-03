import { Component, Input, AfterViewInit, OnDestroy, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-google-adsense',
  standalone: true,
  imports: [],
  templateUrl: './google-adsense.html',
  styleUrl: './google-adsense.css'
})
export class GoogleAdsense implements AfterViewInit, OnDestroy {
  @Input() adClient: string = 'ca-pub-XXXXXXXXXXXXXXXX'; // Replace with your AdSense client ID
  @Input() adSlot: string = ''; // Ad slot ID from AdSense
  @Input() adFormat: string = 'auto'; // 'auto', 'rectangle', 'vertical', 'horizontal'
  @Input() fullWidthResponsive: boolean = true;
  @Input() adTest: string = 'off'; // Set to 'on' for testing, 'off' for production
  
  private adLoaded = false;
  
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId) && this.canShowAds()) {
      this.loadAdSenseScript();
    }
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  /**
   * Check if ads can be shown based on cookie consent
   */
  private canShowAds(): boolean {
    try {
      const consent = localStorage.getItem('cookieConsent');
      if (!consent) {
        return false; // No consent given yet
      }

      const consentData = JSON.parse(consent);
      return consentData.preferences?.advertising === true;
    } catch (error) {
      console.error('Error checking ad consent:', error);
      return false;
    }
  }

  /**
   * Load Google AdSense script dynamically
   */
  private loadAdSenseScript(): void {
    if (this.adLoaded) {
      return;
    }

    try {
      // Check if script already exists
      const existingScript = document.querySelector('script[src*="adsbygoogle.js"]');
      
      if (!existingScript) {
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${this.adClient}`;
        script.crossOrigin = 'anonymous';
        document.head.appendChild(script);
      }

      // Push ad after a short delay to ensure script is loaded
      setTimeout(() => {
        this.pushAd();
      }, 100);

      this.adLoaded = true;
    } catch (error) {
      console.error('Error loading AdSense script:', error);
    }
  }

  /**
   * Push ad to Google AdSense
   */
  private pushAd(): void {
    try {
      if (isPlatformBrowser(this.platformId)) {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      }
    } catch (error) {
      console.error('Error pushing ad:', error);
    }
  }
}

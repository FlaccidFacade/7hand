import { Injectable } from '@angular/core';

export interface AdSenseConfig {
  adClient: string;
  enabled: boolean;
  testMode: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AdsenseService {
  private config: AdSenseConfig = {
    adClient: 'ca-pub-XXXXXXXXXXXXXXXX', // Replace with your actual AdSense client ID
    enabled: true,
    testMode: true // Set to false in production
  };

  /**
   * Ad slot configurations for different positions
   */
  private adSlots = {
    sidebarLeft: '1234567890',    // Replace with your actual ad slot ID
    sidebarRight: '0987654321',   // Replace with your actual ad slot ID
    banner: '1122334455',          // Replace with your actual ad slot ID
    inContent: '5544332211'        // Replace with your actual ad slot ID
  };

  constructor() {
    this.loadConfig();
  }

  /**
   * Get AdSense configuration
   */
  getConfig(): AdSenseConfig {
    return this.config;
  }

  /**
   * Get ad slot ID by position
   */
  getAdSlot(position: 'sidebarLeft' | 'sidebarRight' | 'banner' | 'inContent'): string {
    return this.adSlots[position];
  }

  /**
   * Check if ads are enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Check if in test mode
   */
  isTestMode(): boolean {
    return this.config.testMode;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AdSenseConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
  }

  /**
   * Load configuration from localStorage
   */
  private loadConfig(): void {
    try {
      const savedConfig = localStorage.getItem('adsenseConfig');
      if (savedConfig) {
        this.config = { ...this.config, ...JSON.parse(savedConfig) };
      }
    } catch (error) {
      console.error('Error loading AdSense config:', error);
    }
  }

  /**
   * Save configuration to localStorage
   */
  private saveConfig(): void {
    try {
      localStorage.setItem('adsenseConfig', JSON.stringify(this.config));
    } catch (error) {
      console.error('Error saving AdSense config:', error);
    }
  }
}

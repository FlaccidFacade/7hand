import { TestBed } from '@angular/core/testing';
import { AdsenseService } from './adsense.service';

describe('AdsenseService', () => {
  let service: AdsenseService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AdsenseService);
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have default configuration', () => {
    const config = service.getConfig();
    expect(config.enabled).toBe(true);
    expect(config.testMode).toBe(true);
  });

  it('should return ad slot IDs', () => {
    const leftSlot = service.getAdSlot('sidebarLeft');
    expect(leftSlot).toBeDefined();
    expect(typeof leftSlot).toBe('string');
  });

  it('should update configuration', () => {
    service.updateConfig({ enabled: false });
    expect(service.isEnabled()).toBe(false);
  });

  it('should save and load configuration', () => {
    service.updateConfig({ testMode: false });
    const newService = new AdsenseService();
    expect(newService.isTestMode()).toBe(false);
  });
});

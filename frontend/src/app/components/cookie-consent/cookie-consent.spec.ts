import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CookieConsent } from './cookie-consent';

describe('CookieConsent', () => {
  let component: CookieConsent;
  let fixture: ComponentFixture<CookieConsent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CookieConsent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CookieConsent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show banner if no consent stored', () => {
    localStorage.removeItem('cookieConsent');
    component.ngOnInit();
    expect(component.showBanner).toBe(true);
  });

  it('should not show banner if consent already stored', () => {
    localStorage.setItem('cookieConsent', JSON.stringify({ preferences: {} }));
    component.ngOnInit();
    expect(component.showBanner).toBe(false);
  });
});

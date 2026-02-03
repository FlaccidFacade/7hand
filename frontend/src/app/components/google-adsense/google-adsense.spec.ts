import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GoogleAdsense } from './google-adsense';

describe('GoogleAdsense', () => {
  let component: GoogleAdsense;
  let fixture: ComponentFixture<GoogleAdsense>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GoogleAdsense]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GoogleAdsense);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default adClient', () => {
    expect(component.adClient).toBe('ca-pub-XXXXXXXXXXXXXXXX');
  });

  it('should have adFormat set to auto by default', () => {
    expect(component.adFormat).toBe('auto');
  });

  it('should have fullWidthResponsive enabled by default', () => {
    expect(component.fullWidthResponsive).toBe(true);
  });
});

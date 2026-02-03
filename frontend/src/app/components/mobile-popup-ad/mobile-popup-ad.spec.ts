import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MobilePopupAd } from './mobile-popup-ad';

describe('MobilePopupAd', () => {
  let component: MobilePopupAd;
  let fixture: ComponentFixture<MobilePopupAd>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobilePopupAd]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MobilePopupAd);
    component = fixture.componentInstance;
    sessionStorage.clear();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not show popup initially', () => {
    expect(component.showPopup).toBe(false);
  });

  it('should close popup when closePopup is called', () => {
    component.showPopup = true;
    component.closePopup();
    expect(component.showPopup).toBe(false);
  });

  it('should not show popup if already shown in session', () => {
    sessionStorage.setItem('mobilePopupShown', 'true');
    fixture = TestBed.createComponent(MobilePopupAd);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.showPopup).toBe(false);
  });
});

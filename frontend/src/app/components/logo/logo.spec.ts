import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';

import { Logo } from './logo';

describe('Logo', () => {
  let component: Logo;
  let fixture: ComponentFixture<Logo>;
  let debugElement: DebugElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Logo]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Logo);
    component = fixture.componentInstance;
    debugElement = fixture.debugElement;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the logo container', () => {
    const logoContainer = debugElement.query(By.css('.logo-container'));
    expect(logoContainer).toBeTruthy();
  });

  it('should render the SVG logo', () => {
    const logoSvg = debugElement.query(By.css('.logo-svg'));
    expect(logoSvg).toBeTruthy();
    expect(logoSvg.nativeElement.tagName.toLowerCase()).toBe('svg');
  });

  it('should contain the number 7 in the logo', () => {
    const svgText = debugElement.query(By.css('text'));
    expect(svgText).toBeTruthy();
    expect(svgText.nativeElement.textContent).toContain('7');
  });

  it('should have correct viewBox dimensions', () => {
    const logoSvg = debugElement.query(By.css('.logo-svg'));
    expect(logoSvg.nativeElement.getAttribute('viewBox')).toBe('0 0 300 100');
  });

  it('should contain game title text', () => {
    const textElements = debugElement.queryAll(By.css('text'));
    const textContent = textElements.map(el => el.nativeElement.textContent).join(' ');
    expect(textContent).toContain('Seven Hand');
    expect(textContent).toContain('Card Game');
  });
});

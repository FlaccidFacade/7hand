import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';

import { Privacy } from './privacy';

describe('Privacy', () => {
  let component: Privacy;
  let fixture: ComponentFixture<Privacy>;
  let debugElement: DebugElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Privacy],
      providers: [provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Privacy);
    component = fixture.componentInstance;
    debugElement = fixture.debugElement;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the privacy container', () => {
    const privacyContainer = debugElement.query(By.css('.privacy-container'));
    expect(privacyContainer).toBeTruthy();
  });

  it('should display privacy policy title', () => {
    const title = debugElement.query(By.css('h1'));
    expect(title).toBeTruthy();
    expect(title.nativeElement.textContent).toContain('Privacy Policy');
  });

  it('should have a back to home link', () => {
    const backLink = debugElement.query(By.css('.back-link a'));
    expect(backLink).toBeTruthy();
    expect(backLink.nativeElement.getAttribute('routerLink')).toBe('/');
  });

  it('should display multiple sections', () => {
    const sections = debugElement.queryAll(By.css('section'));
    expect(sections.length).toBeGreaterThan(0);
  });
});

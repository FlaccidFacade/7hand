import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { Landing } from './landing';
import { Logo } from '../logo/logo';
import { LoginForm } from '../login-form/login-form';

describe('Landing', () => {
  let component: Landing;
  let fixture: ComponentFixture<Landing>;
  let debugElement: DebugElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Landing, Logo, LoginForm],
      providers: [provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Landing);
    component = fixture.componentInstance;
    debugElement = fixture.debugElement;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the landing container', () => {
    const landingContainer = debugElement.query(By.css('.landing-container'));
    expect(landingContainer).toBeTruthy();
  });

  it('should contain the logo component', () => {
    const logoComponent = debugElement.query(By.css('app-logo'));
    expect(logoComponent).toBeTruthy();
  });

  it('should contain the login form component', () => {
    const loginFormComponent = debugElement.query(By.css('app-login-form'));
    expect(loginFormComponent).toBeTruthy();
  });

  it('should have the correct layout structure', () => {
    const landingContent = debugElement.query(By.css('.landing-content'));
    expect(landingContent).toBeTruthy();
    
    const children = landingContent.children;
    expect(children.length).toBe(3);
    expect(children[0].name).toBe('app-logo');
    expect(children[1].name).toBe('app-login-form');
    expect(children[2].name).toBe('div');
  });

  it('should contain the rules link', () => {
    const rulesButton = debugElement.query(By.css('.rules-link'));
    expect(rulesButton).toBeTruthy();
    expect(rulesButton.nativeElement.textContent.trim()).toBe('View Game Rules');
  });

  it('should call onShowRules when rules button is clicked', () => {
    component.onShowRules = jasmine.createSpy('onShowRules');
    const rulesButton = debugElement.query(By.css('.rules-link'));
    rulesButton.triggerEventHandler('click', null);
    expect(component.onShowRules).toHaveBeenCalled();
  });
});

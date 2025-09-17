import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';

import { LoginForm } from './login-form';

describe('LoginForm', () => {
  let component: LoginForm;
  let fixture: ComponentFixture<LoginForm>;
  let debugElement: DebugElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginForm, ReactiveFormsModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoginForm);
    component = fixture.componentInstance;
    debugElement = fixture.debugElement;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with empty values', () => {
    expect(component.loginForm.get('username')?.value).toBe('');
    expect(component.loginForm.get('password')?.value).toBe('');
  });

  it('should render login form elements', () => {
    const form = debugElement.query(By.css('.login-form'));
    const usernameInput = debugElement.query(By.css('input[formControlName="username"]'));
    const passwordInput = debugElement.query(By.css('input[formControlName="password"]'));
    const submitButton = debugElement.query(By.css('button[type="submit"]'));

    expect(form).toBeTruthy();
    expect(usernameInput).toBeTruthy();
    expect(passwordInput).toBeTruthy();
    expect(submitButton).toBeTruthy();
  });

  it('should display login title', () => {
    const title = debugElement.query(By.css('.login-title'));
    expect(title.nativeElement.textContent).toContain('Login to Seven Hand Card Game');
  });

  it('should validate username field', () => {
    const usernameControl = component.loginForm.get('username');
    
    // Test required validation
    usernameControl?.setValue('');
    usernameControl?.markAsTouched();
    expect(usernameControl?.hasError('required')).toBeTruthy();
    
    // Test minlength validation
    usernameControl?.setValue('ab');
    expect(usernameControl?.hasError('minlength')).toBeTruthy();
    
    // Test valid input
    usernameControl?.setValue('validuser');
    expect(usernameControl?.valid).toBeTruthy();
  });

  it('should validate password field', () => {
    const passwordControl = component.loginForm.get('password');
    
    // Test required validation
    passwordControl?.setValue('');
    passwordControl?.markAsTouched();
    expect(passwordControl?.hasError('required')).toBeTruthy();
    
    // Test minlength validation
    passwordControl?.setValue('12345');
    expect(passwordControl?.hasError('minlength')).toBeTruthy();
    
    // Test valid input
    passwordControl?.setValue('validpassword');
    expect(passwordControl?.valid).toBeTruthy();
  });

  it('should display error messages when fields are invalid and touched', () => {
    const usernameControl = component.loginForm.get('username');
    const passwordControl = component.loginForm.get('password');
    
    usernameControl?.setValue('');
    passwordControl?.setValue('');
    usernameControl?.markAsTouched();
    passwordControl?.markAsTouched();
    
    fixture.detectChanges();
    
    const errorMessages = debugElement.queryAll(By.css('.error-message'));
    expect(errorMessages.length).toBeGreaterThan(0);
  });

  it('should submit form when valid', () => {
    spyOn(console, 'log');
    
    component.loginForm.patchValue({
      username: 'testuser',
      password: 'testpassword'
    });
    
    component.onSubmit();
    
    expect(component.isLoading).toBeTruthy();
  });

  it('should not submit form when invalid', () => {
    spyOn(component, 'markFormGroupTouched' as any);
    
    component.loginForm.patchValue({
      username: '',
      password: ''
    });
    
    component.onSubmit();
    
    expect(component['markFormGroupTouched']).toHaveBeenCalled();
    expect(component.isLoading).toBeFalsy();
  });

  it('should disable submit button when loading', () => {
    component.isLoading = true;
    fixture.detectChanges();
    
    const submitButton = debugElement.query(By.css('button[type="submit"]'));
    expect(submitButton.nativeElement.disabled).toBeTruthy();
  });

  it('should have proper input types', () => {
    const usernameInput = debugElement.query(By.css('input[formControlName="username"]'));
    const passwordInput = debugElement.query(By.css('input[formControlName="password"]'));
    
    expect(usernameInput.nativeElement.type).toBe('text');
    expect(passwordInput.nativeElement.type).toBe('password');
  });

  it('should show demo note', () => {
    const demoNote = debugElement.query(By.css('.demo-note'));
    expect(demoNote.nativeElement.textContent).toContain('Demo credentials');
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RegistrationForm } from './registration-form';
import { UserService } from '../../services/user.service';

describe('RegistrationForm', () => {
  let component: RegistrationForm;
  let fixture: ComponentFixture<RegistrationForm>;
  let mockUserService: jasmine.SpyObj<UserService>;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    mockUserService = jasmine.createSpyObj('UserService', ['registerUser']);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [RegistrationForm, ReactiveFormsModule],
      providers: [
        { provide: UserService, useValue: mockUserService },
        { provide: Router, useValue: mockRouter },
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RegistrationForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with empty form', () => {
    expect(component.registrationForm.get('username')?.value).toBe('');
    expect(component.registrationForm.get('displayName')?.value).toBe('');
    expect(component.registrationForm.get('email')?.value).toBe('');
  });

  it('should validate username is required', () => {
    const username = component.registrationForm.get('username');
    expect(username?.hasError('required')).toBe(true);
  });

  it('should validate username minimum length', () => {
    const username = component.registrationForm.get('username');
    username?.setValue('ab');
    expect(username?.hasError('minlength')).toBe(true);
  });

  it('should validate username pattern', () => {
    const username = component.registrationForm.get('username');
    username?.setValue('user@name!');
    expect(username?.hasError('pattern')).toBe(true);

    username?.setValue('valid_user-123');
    expect(username?.hasError('pattern')).toBe(false);
  });

  it('should validate email format', () => {
    const email = component.registrationForm.get('email');
    email?.setValue('invalid-email');
    expect(email?.hasError('email')).toBe(true);

    email?.setValue('valid@email.com');
    expect(email?.hasError('email')).toBe(false);
  });

  it('should successfully create user', () => {
    const mockUser = {
      id: '123',
      username: 'testuser',
      displayName: 'Test User',
      coins: 0,
      stats: { gamesPlayed: 0, gamesWon: 0, gamesLost: 0 },
      createdAt: '2025-10-22T00:00:00.000Z',
      lastActive: '2025-10-22T00:00:00.000Z'
    };

    mockUserService.registerUser.and.returnValue(of(mockUser));

    component.registrationForm.patchValue({
      username: 'testuser',
      displayName: 'Test User',
      email: 'test@example.com'
    });

    component.onSubmit();

    expect(mockUserService.registerUser).toHaveBeenCalledWith(jasmine.objectContaining({
      username: 'testuser',
      displayName: 'Test User',
      email: 'test@example.com'
    }));
    expect(component.successMessage).toContain('Welcome');
  });

  it('should handle registration error', () => {
    const errorResponse = {
      status: 400,
      error: { error: 'Invalid user data' }
    };

    mockUserService.registerUser.and.returnValue(throwError(() => errorResponse));

    component.registrationForm.patchValue({
      username: 'testuser'
    });

    component.onSubmit();

    expect(component.errorMessage).toBeTruthy();
    expect(component.isLoading).toBe(false);
  });

  it('should handle duplicate username error', () => {
    const errorResponse = {
      status: 409,
      error: { error: 'Username already exists' }
    };

    mockUserService.registerUser.and.returnValue(throwError(() => errorResponse));

    component.registrationForm.patchValue({
      username: 'existinguser'
    });

    component.onSubmit();

    expect(component.errorMessage).toContain('already exists');
  });

  it('should not submit if form is invalid', () => {
    component.registrationForm.patchValue({
      username: 'ab' // too short
    });

    component.onSubmit();

    expect(mockUserService.registerUser).not.toHaveBeenCalled();
  });
});

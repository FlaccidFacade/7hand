import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UserService } from '../../services/user.service';
import { ProfanityValidatorService } from '../../services/profanity-validator.service';

@Component({
  selector: 'app-registration-form',
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './registration-form.html',
  styleUrl: './registration-form.css'
})
export class RegistrationForm implements OnInit {
  @Output() loginClick = new EventEmitter<void>();
  
  registrationForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private formBuilder: FormBuilder,
    private userService: UserService,
    private router: Router,
    private profanityValidator: ProfanityValidatorService
  ) {
    this.registrationForm = this.formBuilder.group({
      username: ['', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(20),
        Validators.pattern(/^[a-zA-Z0-9_-]+$/)
      ]],
      displayName: ['', [Validators.maxLength(30)]],
      email: ['', [Validators.email]]
    });
  }

  ngOnInit(): void {
    // Add profanity validators after rules are loaded
    this.profanityValidator.getRules().subscribe(rules => {
      if (rules) {
        const usernameControl = this.registrationForm.get('username');
        const displayNameControl = this.registrationForm.get('displayName');

        // Add profanity validator to username
        usernameControl?.setValidators([
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(20),
          Validators.pattern(/^[a-zA-Z0-9_-]+$/),
          this.profanityValidatorFn('username')
        ]);
        usernameControl?.updateValueAndValidity({ emitEvent: false });

        // Add profanity validator to display name
        displayNameControl?.setValidators([
          Validators.maxLength(30),
          this.profanityValidatorFn('displayName')
        ]);
        displayNameControl?.updateValueAndValidity({ emitEvent: false });
      }
    });
  }

  /**
   * Custom validator function for profanity checking
   */
  private profanityValidatorFn(fieldName: 'username' | 'displayName') {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }

      const validationResult = fieldName === 'username'
        ? this.profanityValidator.validateUsername(control.value)
        : this.profanityValidator.validateDisplayName(control.value);

      return validationResult.valid ? null : { profanity: true };
    };
  }

  onSubmit(): void {
    if (this.registrationForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const formValue = this.registrationForm.value;
      const userData = {
        username: formValue.username,
        displayName: formValue.displayName || formValue.username,
        email: formValue.email || undefined
      };

      this.userService.createUser(userData).subscribe({
        next: (user) => {
          this.isLoading = false;
          this.successMessage = `Account created successfully! Welcome, ${user.displayName}!`;
          // Store user info in localStorage for demo purposes
          localStorage.setItem('currentUser', JSON.stringify(user));
          // Navigate to /register after 2 seconds
          setTimeout(() => {
            this.router.navigate(['/']);
          }, 2000);
        },
        error: (error) => {
          this.isLoading = false;
          if (error.status === 400) {
            this.errorMessage = error.error.error || 'Invalid user data. Please check your input.';
          } else if (error.status === 409 || error.error.error?.includes('duplicate') || error.error.error?.includes('unique')) {
            this.errorMessage = 'Username already exists. Please choose a different username.';
          } else {
            this.errorMessage = 'Failed to create account. Please try again.';
          }
          console.error('Registration error:', error);
        }
      });
    } else {
      this.markFormGroupTouched();
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.registrationForm.controls).forEach(field => {
      const control = this.registrationForm.get(field);
      control?.markAsTouched({ onlySelf: true });
    });
  }

  get username() {
    return this.registrationForm.get('username');
  }

  get displayName() {
    return this.registrationForm.get('displayName');
  }

  get email() {
    return this.registrationForm.get('email');
  }

  onLoginClick(event: Event): void {
    event.preventDefault();
    this.loginClick.emit();
  }
}

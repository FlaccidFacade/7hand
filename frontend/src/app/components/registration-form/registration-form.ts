import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-registration-form',
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  templateUrl: './registration-form.html',
  styleUrl: './registration-form.css'
})
export class RegistrationForm {
  registrationForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private formBuilder: FormBuilder,
    private userService: UserService,
    private router: Router
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
}

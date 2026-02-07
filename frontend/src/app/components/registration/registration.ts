import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RegistrationForm } from '../registration-form/registration-form';
import { LoginForm } from '../login-form/login-form';
import { RulesDisplay } from '../rules-display/rules-display';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-registration',
  imports: [ RegistrationForm, LoginForm, RouterLink, RulesDisplay, CommonModule],
  templateUrl: './registration.html',
  styleUrls: ['./registration.css']
})
export class Registration {
  showLogin = false;

  onShowLogin(): void {
    this.showLogin = true;
  }

  onShowRegister(): void {
    this.showLogin = false;
  }
}

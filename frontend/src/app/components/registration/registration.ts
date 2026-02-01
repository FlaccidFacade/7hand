import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Logo } from '../logo/logo';
import { RegistrationForm } from '../registration-form/registration-form';
import { RulesDisplay } from '../rules-display/rules-display';

@Component({
  selector: 'app-registration',
  imports: [Logo, RegistrationForm, RouterLink, RulesDisplay],
  templateUrl: './registration.html',
  styleUrl: './registration.css'
})
export class Registration {
}

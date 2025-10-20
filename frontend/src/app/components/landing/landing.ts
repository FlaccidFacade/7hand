import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Logo } from '../logo/logo';
import { LoginForm } from '../login-form/login-form';

@Component({
  selector: 'app-landing',
  imports: [Logo, LoginForm, RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.css'
})
export class Landing {

}

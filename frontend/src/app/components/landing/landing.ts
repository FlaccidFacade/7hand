import { Component } from '@angular/core';
import { Logo } from '../logo/logo';
import { LoginForm } from '../login-form/login-form';

@Component({
  selector: 'app-landing',
  imports: [Logo, LoginForm],
  templateUrl: './landing.html',
  styleUrl: './landing.css'
})
export class Landing {

}

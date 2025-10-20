
import { RouterLink } from '@angular/router';
import { Component, Input } from '@angular/core';
import { Logo } from '../logo/logo';
import { LoginForm } from '../login-form/login-form';

@Component({
  selector: 'app-landing',
  imports: [Logo, LoginForm, RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.css'
})
export class Landing {
  @Input() onShowRules?: () => void;

  showRules() {
    if (this.onShowRules) {
      this.onShowRules();
    }
  }
}

import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HealthService } from './services/health.service';
import { HeaderComponent } from './components/header/header.component';
import { TableTop } from './components/table-top/table-top';
import { CookieConsent } from './components/cookie-consent/cookie-consent';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, TableTop, CookieConsent, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected title = 'card-game-frontend';
  protected health$ = inject(HealthService).getHealth();
  public showLogin = true; // Flag to show login or game content
  public showRulesOverlay = false; // Flag to show rules overlay

  showRules = () => {
    this.showRulesOverlay = true;
  }

  hideRules = () => {
    this.showRulesOverlay = false;
  }
}

import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HealthService } from './services/health.service';
import { AsyncPipe } from '@angular/common';
import { HeaderComponent } from './components/header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AsyncPipe, HeaderComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected title = 'card-game-frontend';
  protected health$ = inject(HealthService).getHealth();
}

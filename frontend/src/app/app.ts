import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HealthService } from './services/health.service';
import { HeaderComponent } from './components/header/header.component';
import { TableTop } from './components/table-top/table-top';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, TableTop],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected title = 'card-game-frontend';
  protected health$ = inject(HealthService).getHealth();
}

import { Component, Input } from '@angular/core';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [AsyncPipe],
  templateUrl: './components/header.component.html',
  styleUrl: './components/header.component.css'
})
export class HeaderComponent {
  @Input() health$: any;
}

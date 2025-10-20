import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent {
  @Input() health$: any;
  @Input() onShowRules?: () => void;

  showRules() {
    if (this.onShowRules) {
      this.onShowRules();
    }
  }
}

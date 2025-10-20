import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-rules-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rules-overlay.html',
  styleUrl: './rules-overlay.css'
})
export class RulesOverlay {
  @Input() isVisible: boolean = false;
  @Output() closeOverlay = new EventEmitter<void>();

  onClose() {
    this.closeOverlay.emit();
  }

  onOverlayClick(event: Event) {
    // Close overlay when clicking on the background
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
}

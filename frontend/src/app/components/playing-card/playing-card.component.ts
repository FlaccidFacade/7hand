import { Component, Input, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'joker';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'JOKER';

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}

@Component({
  selector: 'app-playing-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './playing-card.component.html',
  styleUrls: ['./playing-card.component.css']
})
export class PlayingCardComponent {
  @Input() suit: Suit = 'hearts';
  @Input() rank: Rank = 'A';
  @Input() faceUp: boolean = true;
  @Input() draggable: boolean = true;

  rotation: number = 0;
  isDragging: boolean = false;
  private startX: number = 0;
  private startY: number = 0;
  private startRotation: number = 0;

  get cardId(): string {
    return `${this.rank}-${this.suit}`;
  }

  get suitSymbol(): string {
    const symbols: Record<Suit, string> = {
      hearts: '♥',
      diamonds: '♦',
      clubs: '♣',
      spades: '♠',
      joker: '🃏'
    };
    return symbols[this.suit];
  }

  get suitColor(): string {
    return (this.suit === 'hearts' || this.suit === 'diamonds') ? 'red' : 'black';
  }

  get displayRank(): string {
    return this.rank;
  }

  get isJoker(): boolean {
    return this.suit === 'joker' && this.rank === 'JOKER';
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    if (!this.draggable) return;
    
    event.preventDefault();
    this.isDragging = true;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.startRotation = this.rotation;
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.isDragging || !this.draggable) return;

    const deltaX = event.clientX - this.startX;
    
    // Rotate based on horizontal drag distance
    this.rotation = this.startRotation + (deltaX / 2);
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    this.isDragging = false;
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    if (!this.draggable) return;
    
    event.preventDefault();
    this.isDragging = true;
    const touch = event.touches[0];
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.startRotation = this.rotation;
  }

  @HostListener('document:touchmove', ['$event'])
  onTouchMove(event: TouchEvent): void {
    if (!this.isDragging || !this.draggable) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - this.startX;
    const deltaY = touch.clientY - this.startY;
    
    // Calculate rotation based on drag direction
    this.rotation = this.startRotation + (deltaX / 2);
  }

  @HostListener('document:touchend')
  onTouchEnd(): void {
    this.isDragging = false;
  }

  toggleFace(): void {
    this.faceUp = !this.faceUp;
  }

  resetRotation(): void {
    this.rotation = 0;
  }
}

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlayingCardComponent, Suit, Rank } from '../playing-card/playing-card.component';

@Component({
  selector: 'app-card-demo',
  standalone: true,
  imports: [CommonModule, FormsModule, PlayingCardComponent],
  templateUrl: './card-demo.component.html',
  styleUrls: ['./card-demo.component.css']
})
export class CardDemo {
  suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
  ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  
  selectedSuit: Suit = 'hearts';
  selectedRank: Rank = 'A';
  showFaceUp: boolean = true;
  isDraggable: boolean = true;

  get allCards() {
    const cards: Array<{suit: Suit, rank: Rank}> = [];
    this.suits.forEach(suit => {
      this.ranks.forEach(rank => {
        cards.push({ suit, rank });
      });
    });
    // Add joker as the 53rd card
    cards.push({ suit: 'joker', rank: 'JOKER' });
    return cards;
  }
}

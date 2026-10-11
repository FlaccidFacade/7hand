import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Card, Meld } from '../../services/lobby.service';
import { PlayingCardComponent, Rank, Suit } from '../playing-card/playing-card.component';
import { isJoker, rankName, runCardValue } from '../../services/melds';

export interface BoardSpace {
  playerId: string;
  name: string;
  isMe: boolean;
  isBot: boolean;
  qualified: boolean;
  melds: Meld[];
}

export interface MeldTarget {
  ownerId: string;
  meldId: string;
}

const SUIT_SYMBOLS: Record<string, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

/** The lobby's table: one space per player, holding the sets and runs that player has played. */
@Component({
  selector: 'app-board',
  standalone: true,
  imports: [CommonModule, PlayingCardComponent],
  templateUrl: './board.component.html',
  styleUrls: ['./board.component.css']
})
export class BoardComponent {
  @Input() spaces: BoardSpace[] = [];
  // When true the melds can be clicked to add the selected cards to them
  @Input() targetable = false;
  @Output() meldSelected = new EventEmitter<MeldTarget>();

  onMeldClick(space: BoardSpace, meld: Meld): void {
    if (this.targetable) {
      this.meldSelected.emit({ ownerId: space.playerId, meldId: meld.id });
    }
  }

  meldLabel(meld: Meld): string {
    if (meld.type === 'set') {
      return `Set of ${meld.rank}s`;
    }
    const low = meld.low ?? 1;
    const high = low + meld.cards.length - 1;
    return `Run ${SUIT_SYMBOLS[meld.suit ?? ''] ?? ''} ${rankName(low)}-${rankName(high)}`;
  }

  cardTitle(meld: Meld, index: number): string | null {
    if (!isJoker(meld.cards[index])) {
      return null;
    }
    const stands = meld.type === 'set' ? meld.rank : rankName(runCardValue(meld, index));
    return `Joker standing in for ${stands}`;
  }

  suitOf(card: Card): Suit {
    return card.suit as Suit;
  }

  rankOf(card: Card): Rank {
    return card.rank as Rank;
  }

  trackSpace(_index: number, space: BoardSpace): string {
    return space.playerId;
  }

  trackMeld(_index: number, meld: Meld): string {
    return meld.id;
  }
}

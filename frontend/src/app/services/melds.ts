import { Card, Meld } from './lobby.service';

export const MIN_SET_SIZE = 3;
export const MIN_RUN_SIZE = 4;

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const ACE_HIGH = 14;

export type MeldResult = { meld: Meld } | { error: string };

export interface HandRequirement {
  sets: number;
  runs: number;
}

// What a player must lay down to qualify on the board, by hand number (1-7)
const REQUIREMENTS: HandRequirement[] = [
  { sets: 2, runs: 0 },
  { sets: 1, runs: 1 },
  { sets: 0, runs: 2 },
  { sets: 3, runs: 0 },
  { sets: 2, runs: 1 },
  { sets: 1, runs: 2 },
  { sets: 0, runs: 3 }
];

const NUMBER_WORDS = ['no', 'one', 'two', 'three'];

export function isJoker(card: Card): boolean {
  return card.rank === 'JOKER';
}

export function rankValue(rank: string, aceHigh = false): number {
  if (rank === 'A' && aceHigh) {
    return ACE_HIGH;
  }
  return RANKS.indexOf(rank) + 1;
}

export function rankName(value: number): string {
  return value === ACE_HIGH ? 'A' : RANKS[value - 1];
}

export function requirementFor(handNumber: number): HandRequirement {
  return REQUIREMENTS[Math.min(Math.max(handNumber, 1), REQUIREMENTS.length) - 1];
}

export function describeRequirement(req: HandRequirement): string {
  const parts: string[] = [];
  if (req.sets > 0) {
    parts.push(`${NUMBER_WORDS[req.sets]} ${req.sets === 1 ? 'set' : 'sets'}`);
  }
  if (req.runs > 0) {
    parts.push(`${NUMBER_WORDS[req.runs]} ${req.runs === 1 ? 'run' : 'runs'}`);
  }
  return parts.join(' and ');
}

function splitJokers(cards: Card[]): { naturals: Card[]; jokers: Card[] } {
  return { naturals: cards.filter(c => !isJoker(c)), jokers: cards.filter(isJoker) };
}

const TOO_MANY_JOKERS = 'A meld can\'t have more jokers than real cards';

export function buildSet(cards: Card[]): MeldResult {
  if (cards.length < MIN_SET_SIZE) {
    return { error: `A set needs at least ${MIN_SET_SIZE} cards` };
  }
  const { naturals, jokers } = splitJokers(cards);
  if (naturals.length === 0 || jokers.length > naturals.length) {
    return { error: TOO_MANY_JOKERS };
  }
  const rank = naturals[0].rank;
  if (naturals.some(c => c.rank !== rank)) {
    return { error: 'A set must be all the same rank' };
  }
  return { meld: { id: `meld-${naturals[0].id}`, type: 'set', rank, cards: [...naturals, ...jokers] } };
}

export function buildRun(cards: Card[]): MeldResult {
  if (cards.length < MIN_RUN_SIZE) {
    return { error: `A run needs at least ${MIN_RUN_SIZE} cards` };
  }
  const { naturals, jokers } = splitJokers(cards);
  if (naturals.length === 0 || jokers.length > naturals.length) {
    return { error: TOO_MANY_JOKERS };
  }
  const suit = naturals[0].suit;
  if (naturals.some(c => c.suit !== suit)) {
    return { error: 'A run must be all the same suit' };
  }

  // An ace may be low (A-2-3) or high (Q-K-A), never both
  const aceOptions = naturals.some(c => c.rank === 'A') ? [false, true] : [false];
  let repeated = false;
  for (const aceHigh of aceOptions) {
    const values = naturals.map(c => rankValue(c.rank, aceHigh)).sort((a, b) => a - b);
    if (new Set(values).size !== values.length) {
      repeated = true;
      continue;
    }
    const first = values[0];
    const last = values[values.length - 1];
    const gaps = last - first + 1 - values.length;
    if (gaps > jokers.length) {
      continue;
    }
    // Jokers left over after filling gaps extend the run, upwards first
    const spare = jokers.length - gaps;
    const roomHigh = ACE_HIGH - last;
    const roomLow = first - 1;
    if (spare > roomHigh + roomLow) {
      continue;
    }
    const extendHigh = Math.min(spare, roomHigh);
    const low = first - (spare - extendHigh);
    const high = last + extendHigh;

    const byValue = new Map(naturals.map(c => [rankValue(c.rank, aceHigh), c]));
    const spareJokers = [...jokers];
    const ordered: Card[] = [];
    for (let v = low; v <= high; v++) {
      ordered.push(byValue.get(v) ?? spareJokers.shift()!);
    }
    return { meld: { id: `meld-${naturals[0].id}`, type: 'run', suit, low, cards: ordered } };
  }
  return { error: repeated ? 'A run can\'t repeat a card' : 'Those cards don\'t make a run' };
}

function jokersBalanced(cards: Card[]): boolean {
  const { naturals, jokers } = splitJokers(cards);
  return jokers.length <= naturals.length;
}

/** Adds cards to a meld that is already on the table; runs grow at either end. */
export function addCardsToMeld(meld: Meld, cards: Card[]): MeldResult {
  if (cards.length === 0) {
    return { error: 'Select cards to add' };
  }

  if (meld.type === 'set') {
    if (cards.some(c => !isJoker(c) && c.rank !== meld.rank)) {
      return { error: 'Those cards don\'t match this set' };
    }
    const next = [...meld.cards, ...cards];
    return jokersBalanced(next) ? { meld: { ...meld, cards: next } } : { error: TOO_MANY_JOKERS };
  }

  let low = meld.low ?? 1;
  let placed = [...meld.cards];
  // Real cards are placed before jokers so a joker never takes the spot a real card needs
  const pending = [...cards].sort((a, b) => Number(isJoker(a)) - Number(isJoker(b)));

  const place = (card: Card): 'high' | 'low' | null => {
    const nextHigh = low + placed.length;
    const nextLow = low - 1;
    if (isJoker(card)) {
      if (nextHigh <= ACE_HIGH) return 'high';
      return nextLow >= 1 ? 'low' : null;
    }
    if (card.suit !== meld.suit) {
      return null;
    }
    const values = card.rank === 'A' ? [ACE_HIGH, 1] : [rankValue(card.rank)];
    if (values.includes(nextHigh)) return 'high';
    return values.includes(nextLow) ? 'low' : null;
  };

  let progress = true;
  while (pending.length > 0 && progress) {
    progress = false;
    for (let i = 0; i < pending.length; i++) {
      const side = place(pending[i]);
      if (side) {
        const [card] = pending.splice(i, 1);
        if (side === 'high') {
          placed = [...placed, card];
        } else {
          placed = [card, ...placed];
          low -= 1;
        }
        progress = true;
        break;
      }
    }
  }
  if (pending.length > 0) {
    return { error: 'Those cards don\'t extend this run' };
  }
  return jokersBalanced(placed) ? { meld: { ...meld, low, cards: placed } } : { error: TOO_MANY_JOKERS };
}

/** The rank a card stands for inside a run, used to label jokers. */
export function runCardValue(meld: Meld, index: number): number {
  return (meld.low ?? 1) + index;
}

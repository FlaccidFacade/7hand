import { Card, GameState, Meld } from './lobby.service';
import {
  HandRequirement,
  addCardsToMeld,
  buildRun,
  buildSet,
  describeRequirement,
  isJoker,
  rankValue,
  requirementFor
} from './melds';

export type DrawSource = 'deck' | 'discard';

export interface MeldGroup {
  type: 'set' | 'run';
  cardIds: string[];
}

const RANK_VALUE: Record<string, number> = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13
};

function randomIndex(maxExclusive: number): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] % maxExclusive;
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function isPlayersTurn(state: GameState | null, playerId: string | null): boolean {
  return !!state && !!playerId && state.currentTurn === playerId;
}

export function canDraw(state: GameState | null, playerId: string | null): boolean {
  return isPlayersTurn(state, playerId) && state?.turnPhase === 'draw';
}

export function canDiscard(state: GameState | null, playerId: string | null): boolean {
  return isPlayersTurn(state, playerId) && state?.turnPhase === 'discard';
}

export function isHandOver(state: GameState | null): boolean {
  return state?.phase === 'handOver';
}

// A player with no cards left ends the hand
function finishHand(state: GameState, winnerId: string): GameState {
  return { ...state, phase: 'handOver', winnerId, turnPhase: 'over' };
}

/**
 * Adds either the face-down deck card or the top face-up discard to the player's hand.
 * When the deck is empty, the discard pile (minus its top card) is reshuffled into a new deck.
 */
export function drawCard(state: GameState, playerId: string, source: DrawSource): GameState {
  if (!canDraw(state, playerId)) {
    throw new Error('It is not time to draw');
  }

  let drawPile = [...(state.drawPile ?? [])];
  let discardPile = [...(state.discardPile ?? [])];
  let card: Card | undefined;

  if (source === 'discard') {
    card = discardPile.pop();
  } else {
    if (drawPile.length === 0) {
      const top = discardPile.pop();
      drawPile = shuffle(discardPile);
      discardPile = top ? [top] : [];
    }
    card = drawPile.shift();
  }
  if (!card) {
    throw new Error('No card available to draw');
  }

  const hand = state.hands?.[playerId] ?? [];
  return {
    ...state,
    drawPile,
    discardPile,
    hands: { ...state.hands, [playerId]: [...hand, card] },
    turnPhase: 'discard'
  };
}

/** Throws a card face up onto the discard pile and passes the turn to the next player. */
export function discardCard(state: GameState, playerId: string, cardId: string): GameState {
  if (!canDiscard(state, playerId)) {
    throw new Error('It is not time to discard');
  }
  const hand = state.hands?.[playerId] ?? [];
  const card = hand.find(c => c.id === cardId);
  if (!card) {
    throw new Error('Card is not in the hand');
  }

  const remaining = hand.filter(c => c.id !== cardId);
  const thrown: GameState = {
    ...state,
    discardPile: [...(state.discardPile ?? []), card],
    hands: { ...state.hands, [playerId]: remaining }
  };
  if (remaining.length === 0) {
    return finishHand(thrown, playerId);
  }

  const order = state.turnOrder ?? [];
  const next = order.length > 0 ? order[(order.indexOf(playerId) + 1) % order.length] : playerId;
  return { ...thrown, currentTurn: next, turnPhase: 'draw' };
}

function takeCards(hand: Card[], cardIds: string[], taken: Set<string>): Card[] {
  return cardIds.map(id => {
    const card = hand.find(c => c.id === id);
    if (!card || taken.has(id)) {
      throw new Error('Card is not in your hand');
    }
    taken.add(id);
    return card;
  });
}

function assertCanPlayCards(state: GameState, playerId: string): void {
  if (!canDiscard(state, playerId)) {
    throw new Error('Draw a card before playing on the table');
  }
}

/**
 * Lays new sets and runs from the hand onto the player's space on the table.
 * A player's first play must meet the requirement for the current hand.
 */
export function playMelds(state: GameState, playerId: string, groups: MeldGroup[]): GameState {
  assertCanPlayCards(state, playerId);
  if (groups.length === 0) {
    throw new Error('Choose cards to play');
  }

  const hand = state.hands?.[playerId] ?? [];
  const taken = new Set<string>();
  const melds: Meld[] = groups.map(group => {
    const cards = takeCards(hand, group.cardIds, taken);
    const result = group.type === 'set' ? buildSet(cards) : buildRun(cards);
    if ('error' in result) {
      throw new Error(result.error);
    }
    return result.meld;
  });

  if (!state.qualified?.[playerId]) {
    const handNumber = state.handNumber ?? 1;
    const req = requirementFor(handNumber);
    const sets = melds.filter(m => m.type === 'set').length;
    const runs = melds.filter(m => m.type === 'run').length;
    if (sets < req.sets || runs < req.runs) {
      throw new Error(`Hand ${handNumber} needs ${describeRequirement(req)} to qualify`);
    }
  }

  const remaining = hand.filter(c => !taken.has(c.id));
  const next: GameState = {
    ...state,
    hands: { ...state.hands, [playerId]: remaining },
    board: { ...state.board, [playerId]: [...(state.board?.[playerId] ?? []), ...melds] },
    qualified: { ...state.qualified, [playerId]: true }
  };
  return remaining.length === 0 ? finishHand(next, playerId) : next;
}

/** Adds cards from the hand to a set or run already on the table, whoever laid it down. */
export function addToMeld(
  state: GameState,
  playerId: string,
  ownerId: string,
  meldId: string,
  cardIds: string[]
): GameState {
  assertCanPlayCards(state, playerId);
  if (!state.qualified?.[playerId]) {
    throw new Error('Qualify on the table before adding to other melds');
  }
  const melds = state.board?.[ownerId] ?? [];
  const index = melds.findIndex(m => m.id === meldId);
  if (index < 0) {
    throw new Error('That meld is not on the table');
  }

  const hand = state.hands?.[playerId] ?? [];
  const taken = new Set<string>();
  const cards = takeCards(hand, cardIds, taken);
  const result = addCardsToMeld(melds[index], cards);
  if ('error' in result) {
    throw new Error(result.error);
  }

  const remaining = hand.filter(c => !taken.has(c.id));
  const next: GameState = {
    ...state,
    hands: { ...state.hands, [playerId]: remaining },
    board: { ...state.board, [ownerId]: melds.map((m, i) => (i === index ? result.meld : m)) }
  };
  return remaining.length === 0 ? finishHand(next, playerId) : next;
}

function chooseBotSource(state: GameState, botId: string): DrawSource {
  const pile = state.discardPile ?? [];
  const top = pile[pile.length - 1];
  const hand = state.hands?.[botId] ?? [];
  return top && hand.some(c => c.rank === top.rank) ? 'discard' : 'deck';
}

function chooseBotDiscard(state: GameState, botId: string): Card {
  const hand = state.hands?.[botId] ?? [];
  const counts = new Map<string, number>();
  hand.forEach(c => counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1));

  const candidates = hand.filter(c => c.rank !== 'JOKER');
  const unmatched = candidates.filter(c => counts.get(c.rank) === 1);
  const pool = unmatched.length > 0 ? unmatched : candidates.length > 0 ? candidates : hand;
  return pool.reduce((worst, c) =>
    (RANK_VALUE[c.rank] ?? 0) > (RANK_VALUE[worst.rank] ?? 0) ? c : worst
  );
}

interface Candidate {
  type: 'set' | 'run';
  cardIds: string[];
  jokersNeeded: number;
}

function setCandidates(naturals: Card[], jokerCount: number): Candidate[] {
  const byRank = new Map<string, Card[]>();
  naturals.forEach(c => byRank.set(c.rank, [...(byRank.get(c.rank) ?? []), c]));

  const found: Candidate[] = [];
  byRank.forEach(cards => {
    if (cards.length >= 3) {
      found.push({ type: 'set', cardIds: cards.slice(0, 3).map(c => c.id), jokersNeeded: 0 });
      if (cards.length > 3) {
        found.push({ type: 'set', cardIds: cards.map(c => c.id), jokersNeeded: 0 });
      }
    }
    if (cards.length >= 2 && jokerCount >= 1) {
      found.push({ type: 'set', cardIds: cards.slice(0, 2).map(c => c.id), jokersNeeded: 1 });
    }
  });
  return found;
}

function runCandidates(naturals: Card[], jokerCount: number): Candidate[] {
  const found: Candidate[] = [];
  for (const suit of new Set(naturals.map(c => c.suit))) {
    const ofSuit = naturals.filter(c => c.suit === suit);
    for (const aceHigh of [false, true]) {
      const byValue = new Map(ofSuit.map(c => [rankValue(c.rank, aceHigh), c]));
      for (let low = 1; low <= 11; low++) {
        for (let high = low + 3; high <= 14; high++) {
          if (!byValue.has(low) || !byValue.has(high)) {
            continue;
          }
          const present: Card[] = [];
          for (let v = low; v <= high; v++) {
            const card = byValue.get(v);
            if (card) present.push(card);
          }
          const missing = high - low + 1 - present.length;
          if (missing <= jokerCount && missing <= present.length) {
            found.push({ type: 'run', cardIds: present.map(c => c.id), jokersNeeded: missing });
          }
        }
      }
    }
  }
  return found;
}

// Searches the hand for non-overlapping melds that satisfy the hand's requirement
function findQualifyingGroups(hand: Card[], req: HandRequirement): MeldGroup[] | null {
  const jokers = hand.filter(isJoker);
  const naturals = hand.filter(c => !isJoker(c));
  const sets = setCandidates(naturals, jokers.length);
  const runs = runCandidates(naturals, jokers.length);
  const wanted: Array<'set' | 'run'> = [
    ...Array<'run'>(req.runs).fill('run'),
    ...Array<'set'>(req.sets).fill('set')
  ];

  const search = (i: number, used: Set<string>, chosen: MeldGroup[]): MeldGroup[] | null => {
    if (i === wanted.length) {
      return chosen;
    }
    for (const candidate of wanted[i] === 'run' ? runs : sets) {
      if (candidate.cardIds.some(id => used.has(id))) {
        continue;
      }
      const jokerIds = jokers.filter(j => !used.has(j.id)).slice(0, candidate.jokersNeeded).map(j => j.id);
      if (jokerIds.length < candidate.jokersNeeded) {
        continue;
      }
      const ids = [...candidate.cardIds, ...jokerIds];
      ids.forEach(id => used.add(id));
      const result = search(i + 1, used, [...chosen, { type: candidate.type, cardIds: ids }]);
      if (result) {
        return result;
      }
      ids.forEach(id => used.delete(id));
    }
    return null;
  };
  return search(0, new Set(), []);
}

// One step of a bot's playing phase: qualify on the table, or add a card to a meld already there
function botPlayCards(state: GameState, botId: string): GameState | null {
  const hand = state.hands?.[botId] ?? [];

  if (!state.qualified?.[botId]) {
    const groups = findQualifyingGroups(hand, requirementFor(state.handNumber ?? 1));
    if (!groups) {
      return null;
    }
    try {
      return playMelds(state, botId, groups);
    } catch {
      return null;
    }
  }

  for (const card of hand.filter(c => !isJoker(c))) {
    for (const [ownerId, melds] of Object.entries(state.board ?? {})) {
      for (const meld of melds) {
        if (!('meld' in addCardsToMeld(meld, [card]))) {
          continue;
        }
        return addToMeld(state, botId, ownerId, meld.id, [card.id]);
      }
    }
  }
  return null;
}

/** Plays the next step (draw, play on the table, or discard) for a computer player. */
export function playBotStep(state: GameState, botId: string): GameState {
  if (canDraw(state, botId)) {
    return drawCard(state, botId, chooseBotSource(state, botId));
  }
  return botPlayCards(state, botId) ?? discardCard(state, botId, chooseBotDiscard(state, botId).id);
}

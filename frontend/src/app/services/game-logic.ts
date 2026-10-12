import { Card, GameState, Meld } from './lobby.service';
import {
  HandRequirement,
  HAND_NUMBERS,
  addCardsToMeld,
  buildRun,
  buildSet,
  describeRequirement,
  handDifficulty,
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
  return state?.phase === 'handOver' || state?.phase === 'gameOver';
}

function availableHands(state: GameState, playerId: string): number[] {
  const completed = state.completedHands?.[playerId] ?? [];
  const removed = state.removedHands?.[playerId] ?? [];
  return HAND_NUMBERS.filter(hand => !completed.includes(hand) && !removed.includes(hand));
}

// An early finish removes the easiest remaining hand from each player who did not qualify.
function finishHand(state: GameState, winnerId: string): GameState {
  const removedHands = { ...state.removedHands };
  for (const playerId of state.turnOrder ?? []) {
    if (state.qualified?.[playerId]) {
      continue;
    }
    const easiest = availableHands(state, playerId).sort((a, b) => handDifficulty(a) - handDifficulty(b))[0];
    if (easiest !== undefined) {
      removedHands[playerId] = [...(removedHands[playerId] ?? []), easiest];
    }
  }
  const phase = (state.handNumber ?? 1) >= (state.totalHands ?? 7) ? 'gameOver' : 'handOver';
  return { ...state, phase, winnerId, removedHands, turnPhase: 'over' };
}

/** Selects the one hand a player will qualify with this round. */
export function selectHand(state: GameState, playerId: string, handNumber: number): GameState {
  if (state.phase !== 'playing' || state.qualified?.[playerId]) {
    throw new Error('You cannot change your hand choice now');
  }
  if (!availableHands(state, playerId).includes(handNumber)) {
    throw new Error('That hand is no longer available');
  }
  return { ...state, selectedHands: { ...state.selectedHands, [playerId]: handNumber } };
}

/** Deals the next round while preserving each player's completed and removed hands. */
export function startNextHand(state: GameState): GameState {
  if (state.phase !== 'handOver') {
    throw new Error('The current hand is not over');
  }
  const handNumber = (state.handNumber ?? 1) + 1;
  if (handNumber > (state.totalHands ?? 7)) {
    return { ...state, phase: 'gameOver', turnPhase: 'over' };
  }

  const turnOrder = state.turnOrder ?? [];
  if (turnOrder.length === 0) {
    throw new Error('At least one player is required');
  }
  const deck = shuffle(createGameDeck(handNumber));
  const hands: Record<string, Card[]> = {};
  turnOrder.forEach(playerId => {
    hands[playerId] = deck.splice(0, 11);
  });
  const discardPile = deck.splice(0, 1);
  const firstPlayer = turnOrder[(handNumber - 1) % turnOrder.length];

  return {
    ...state,
    phase: 'playing',
    handNumber,
    currentTurn: firstPlayer,
    turnPhase: 'draw',
    hands,
    drawPile: deck,
    discardPile,
    board: Object.fromEntries(turnOrder.map(playerId => [playerId, []])),
    qualified: Object.fromEntries(turnOrder.map(playerId => [playerId, false])),
    selectedHands: Object.fromEntries(turnOrder.map(playerId => [playerId, null])),
    winnerId: undefined
  };
}

function createGameDeck(handNumber: number): Card[] {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck: Card[] = [];
  for (let copy = 0; copy < 2; copy++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ id: `hand-${handNumber}-${copy}-${suit}-${rank}`, suit, rank });
      }
    }
  }
  for (let joker = 0; joker < 4; joker++) {
    deck.push({ id: `hand-${handNumber}-joker-${joker}`, suit: 'joker', rank: 'JOKER' });
  }
  return deck;
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
    const handNumber = state.selectedHands
      ? state.selectedHands[playerId]
      : state.handNumber ?? 1;
    if (handNumber === null || handNumber === undefined) {
      throw new Error('Choose an available hand before laying down');
    }
    if (!availableHands(state, playerId).includes(handNumber)) {
      throw new Error('That hand is no longer available');
    }
    const req = requirementFor(handNumber);
    const trips = melds.filter(m => m.type === 'set').length;
    const sets = melds.filter(m => m.type === 'run').length;
    if (trips !== req.trips || sets !== req.sets) {
      throw new Error(`Hand ${handNumber} needs exactly ${describeRequirement(req)} to qualify`);
    }
  }

  const remaining = hand.filter(c => !taken.has(c.id));
  const selectedHand = state.selectedHands?.[playerId] ?? state.handNumber ?? 1;
  const completedHands = !state.qualified?.[playerId] && state.completedHands
    ? { ...state.completedHands, [playerId]: [...(state.completedHands[playerId] ?? []), selectedHand] }
    : state.completedHands;
  const next: GameState = {
    ...state,
    hands: { ...state.hands, [playerId]: remaining },
    board: { ...state.board, [playerId]: [...(state.board?.[playerId] ?? []), ...melds] },
    qualified: { ...state.qualified, [playerId]: true },
    completedHands
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
    ...Array<'run'>(req.sets).fill('run'),
    ...Array<'set'>(req.trips).fill('set')
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
    let choice = state.selectedHands?.[botId] ?? null;
    if (!choice) {
      const options = availableHands(state, botId);
      choice = options.find(option => findQualifyingGroups(hand, requirementFor(option))) ?? options[0] ?? null;
      if (choice !== null) {
        state = selectHand(state, botId, choice);
      }
    }
    if (choice === null) {
      return null;
    }
    const groups = findQualifyingGroups(hand, requirementFor(choice));
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

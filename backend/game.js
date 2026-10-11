// game.js - Game setup logic (deck creation, shuffling and dealing)

const crypto = require('crypto');

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const DECK_COUNT = 2;
const JOKERS_PER_GAME = 4;
const CARDS_PER_PLAYER = 11;
const TOTAL_HANDS = 7;

function createDeck() {
  const cards = [];
  for (let deck = 0; deck < DECK_COUNT; deck++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ id: `${deck}-${suit}-${rank}`, suit, rank });
      }
    }
  }
  for (let i = 0; i < JOKERS_PER_GAME; i++) {
    cards.push({ id: `joker-${i}`, suit: 'joker', rank: 'JOKER' });
  }
  return cards;
}

function shuffle(cards) {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function dealGame(players) {
  if (!Array.isArray(players) || players.length === 0) {
    throw new Error('At least one player is required');
  }
  const deck = shuffle(createDeck());
  if (deck.length < players.length * CARDS_PER_PLAYER + 1) {
    throw new Error('Too many players for the deck');
  }

  const hands = {};
  players.forEach(player => {
    hands[player.id] = deck.splice(0, CARDS_PER_PLAYER);
  });
  const discardPile = deck.splice(0, 1);

  return {
    phase: 'playing',
    botGame: false,
    handNumber: 1,
    totalHands: TOTAL_HANDS,
    turnOrder: players.map(p => p.id),
    currentTurn: players[0].id,
    turnPhase: 'draw',
    hands,
    drawPile: deck,
    discardPile,
    scores: Object.fromEntries(players.map(p => [p.id, 0])),
    // One table per lobby with a space for every player's sets and runs
    board: Object.fromEntries(players.map(p => [p.id, []])),
    qualified: Object.fromEntries(players.map(p => [p.id, false])),
    startedAt: new Date().toISOString()
  };
}

module.exports = {
  CARDS_PER_PLAYER,
  TOTAL_HANDS,
  createDeck,
  shuffle,
  dealGame
};

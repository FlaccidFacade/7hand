const { createDeck, shuffle, dealGame, CARDS_PER_PLAYER } = require('../game');

const makePlayers = n => Array.from({ length: n }, (_, i) => ({ id: `p${i}` }));

describe('game', () => {
  it('should create two decks plus four jokers', () => {
    const deck = createDeck();
    expect(deck.length).toBe(108);
    expect(deck.filter(c => c.suit === 'joker').length).toBe(4);
    expect(new Set(deck.map(c => c.id)).size).toBe(108);
  });

  it('should shuffle without losing cards or mutating the input', () => {
    const deck = createDeck();
    const copy = [...deck];
    const shuffled = shuffle(deck);
    expect(deck).toEqual(copy);
    expect(shuffled.length).toBe(deck.length);
    expect(shuffled.map(c => c.id).sort()).toEqual(deck.map(c => c.id).sort());
  });

  it('should deal 11 cards to every player and one discard', () => {
    const state = dealGame(makePlayers(6));
    Object.values(state.hands).forEach(hand => expect(hand.length).toBe(CARDS_PER_PLAYER));
    expect(state.discardPile.length).toBe(1);
    expect(state.drawPile.length).toBe(108 - 6 * 11 - 1);
    const ids = [
      ...Object.values(state.hands).flat(),
      ...state.drawPile,
      ...state.discardPile
    ].map(c => c.id);
    expect(new Set(ids).size).toBe(108);
  });

  it('should set initial turn and hand info', () => {
    const state = dealGame(makePlayers(3));
    expect(state.phase).toBe('playing');
    expect(state.handNumber).toBe(1);
    expect(state.totalHands).toBe(7);
    expect(state.currentTurn).toBe('p0');
    expect(state.turnOrder).toEqual(['p0', 'p1', 'p2']);
    expect(state.scores).toEqual({ p0: 0, p1: 0, p2: 0 });
  });

  it('should give the table one empty space per player and nobody qualified', () => {
    const state = dealGame(makePlayers(4));
    expect(state.board).toEqual({ p0: [], p1: [], p2: [], p3: [] });
    expect(state.qualified).toEqual({ p0: false, p1: false, p2: false, p3: false });
  });

  it('should reject an empty player list', () => {
    expect(() => dealGame([])).toThrow();
  });
});

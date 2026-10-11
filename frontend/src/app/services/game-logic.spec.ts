import { Card, GameState } from './lobby.service';
import { addToMeld, canDiscard, canDraw, discardCard, drawCard, isHandOver, playBotStep, playMelds } from './game-logic';

const card = (id: string, suit: string, rank: string): Card => ({ id, suit, rank });

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: 'playing',
    turnOrder: ['me', 'bot-1'],
    currentTurn: 'me',
    turnPhase: 'draw',
    hands: {
      me: [card('m1', 'hearts', '4'), card('m2', 'clubs', 'K')],
      'bot-1': [card('b1', 'spades', '9'), card('b2', 'spades', '9'), card('b3', 'hearts', 'K'), card('b4', 'joker', 'JOKER')]
    },
    drawPile: [card('d1', 'clubs', '5'), card('d2', 'clubs', '6')],
    discardPile: [card('x1', 'hearts', '3'), card('x2', 'diamonds', 'Q')],
    ...overrides
  };
}

describe('game-logic', () => {
  describe('drawCard', () => {
    it('should add the face-down deck card to the hand and move to the discard phase', () => {
      const next = drawCard(makeState(), 'me', 'deck');

      expect(next.hands!['me'].map(c => c.id)).toEqual(['m1', 'm2', 'd1']);
      expect(next.drawPile!.map(c => c.id)).toEqual(['d2']);
      expect(next.discardPile!.length).toBe(2);
      expect(next.turnPhase).toBe('discard');
      expect(next.currentTurn).toBe('me');
    });

    it('should take the top face-up card from the discard pile', () => {
      const next = drawCard(makeState(), 'me', 'discard');

      expect(next.hands!['me'].map(c => c.id)).toEqual(['m1', 'm2', 'x2']);
      expect(next.discardPile!.map(c => c.id)).toEqual(['x1']);
      expect(next.drawPile!.length).toBe(2);
      expect(next.turnPhase).toBe('discard');
    });

    it('should not mutate the previous state', () => {
      const state = makeState();
      drawCard(state, 'me', 'deck');

      expect(state.hands!['me'].length).toBe(2);
      expect(state.drawPile!.length).toBe(2);
    });

    it('should reshuffle the discard pile into the deck when the deck is empty', () => {
      const next = drawCard(makeState({ drawPile: [] }), 'me', 'deck');

      expect(next.hands!['me'].map(c => c.id)).toEqual(['m1', 'm2', 'x1']);
      expect(next.discardPile!.map(c => c.id)).toEqual(['x2']);
      expect(next.drawPile!.length).toBe(0);
    });

    it('should reject drawing out of turn or in the wrong phase', () => {
      expect(() => drawCard(makeState(), 'bot-1', 'deck')).toThrow();
      expect(() => drawCard(makeState({ turnPhase: 'discard' }), 'me', 'deck')).toThrow();
    });

    it('should reject drawing when no card is available', () => {
      const empty = makeState({ drawPile: [], discardPile: [] });
      expect(() => drawCard(empty, 'me', 'deck')).toThrow();
      expect(() => drawCard(empty, 'me', 'discard')).toThrow();
    });
  });

  describe('discardCard', () => {
    it('should throw the card face up on the stack and pass the turn', () => {
      const drawn = drawCard(makeState(), 'me', 'deck');
      const next = discardCard(drawn, 'me', 'm2');

      expect(next.hands!['me'].map(c => c.id)).toEqual(['m1', 'd1']);
      expect(next.discardPile!.map(c => c.id)).toEqual(['x1', 'x2', 'm2']);
      expect(next.currentTurn).toBe('bot-1');
      expect(next.turnPhase).toBe('draw');
    });

    it('should wrap around to the first player', () => {
      const state = makeState({ currentTurn: 'bot-1', turnPhase: 'discard' });
      expect(discardCard(state, 'bot-1', 'b1').currentTurn).toBe('me');
    });

    it('should reject discarding before drawing, out of turn, or a card not in hand', () => {
      expect(() => discardCard(makeState(), 'me', 'm1')).toThrow();
      expect(() => discardCard(makeState({ turnPhase: 'discard' }), 'bot-1', 'b1')).toThrow();
      expect(() => discardCard(makeState({ turnPhase: 'discard' }), 'me', 'nope')).toThrow();
    });
  });

  describe('turn checks', () => {
    it('should report who can draw or discard', () => {
      expect(canDraw(makeState(), 'me')).toBe(true);
      expect(canDraw(makeState(), 'bot-1')).toBe(false);
      expect(canDraw(null, 'me')).toBe(false);
      expect(canDiscard(makeState({ turnPhase: 'discard' }), 'me')).toBe(true);
      expect(canDiscard(makeState(), 'me')).toBe(false);
    });
  });

  describe('playBotStep', () => {
    it('should take the face-up card when it matches a rank in hand', () => {
      const state = makeState({ currentTurn: 'bot-1', discardPile: [card('x1', 'clubs', 'K')] });
      const next = playBotStep(state, 'bot-1');

      expect(next.hands!['bot-1'].map(c => c.id)).toContain('x1');
      expect(next.turnPhase).toBe('discard');
    });

    it('should draw from the deck when the face-up card is no use', () => {
      const state = makeState({ currentTurn: 'bot-1' });
      const next = playBotStep(state, 'bot-1');

      expect(next.hands!['bot-1'].map(c => c.id)).toContain('d1');
    });

    it('should keep pairs and jokers and throw away the highest unmatched card', () => {
      const state = makeState({ currentTurn: 'bot-1', turnPhase: 'discard' });
      const next = playBotStep(state, 'bot-1');

      expect(next.discardPile![next.discardPile!.length - 1].id).toBe('b3');
      expect(next.currentTurn).toBe('me');
      expect(next.turnPhase).toBe('draw');
    });
  });

  describe('playing on the table', () => {
    const joker = (n: number) => card(`joker-${n}`, 'joker', 'JOKER');
    const sevens = [card('7h', 'hearts', '7'), card('7s', 'spades', '7'), card('7d', 'diamonds', '7')];
    const nines = [card('9h', 'hearts', '9'), card('9s', 'spades', '9'), card('9c', 'clubs', '9')];

    // Hand 1 of the rules: qualify with two sets
    function playState(overrides: Partial<GameState> = {}): GameState {
      return makeState({
        handNumber: 1,
        turnPhase: 'discard',
        hands: { me: [...sevens, ...nines, card('ks', 'spades', 'K'), card('2c', 'clubs', '2')], 'bot-1': [card('b1', 'spades', '4')] },
        board: { me: [], 'bot-1': [] },
        qualified: { me: false, 'bot-1': false },
        ...overrides
      });
    }

    const twoSets = [
      { type: 'set' as const, cardIds: ['7h', '7s', '7d'] },
      { type: 'set' as const, cardIds: ['9h', '9s', '9c'] }
    ];

    describe('playMelds', () => {
      it('should lay sets on the player\'s space of the table and qualify them', () => {
        const next = playMelds(playState(), 'me', twoSets);

        expect(next.board!['me'].map(m => m.type)).toEqual(['set', 'set']);
        expect(next.board!['bot-1']).toEqual([]);
        expect(next.qualified!['me']).toBe(true);
        expect(next.hands!['me'].map(c => c.id)).toEqual(['ks', '2c']);
        expect(next.turnPhase).toBe('discard');
        expect(next.currentTurn).toBe('me');
      });

      it('should reject a first play that does not meet the hand requirement', () => {
        expect(() => playMelds(playState(), 'me', [twoSets[0]])).toThrowError(/Hand 1 needs two sets to qualify/);
      });

      it('should expect a set and a run on hand two', () => {
        const run = { type: 'run' as const, cardIds: ['4h', '5h', '6h', '7h'] };
        const hand = [card('4h', 'hearts', '4'), card('5h', 'hearts', '5'), card('6h', 'hearts', '6'), ...sevens, ...nines];
        const state = playState({ handNumber: 2, hands: { me: hand, 'bot-1': [] } });

        expect(() => playMelds(state, 'me', [twoSets[1], { type: 'set', cardIds: ['7s', '7d', '7h'] }])).toThrowError(
          /one set and one run/
        );
        const next = playMelds(state, 'me', [twoSets[1], run]);
        expect(next.board!['me'].map(m => m.type)).toEqual(['set', 'run']);
      });

      it('should let a qualified player lay further melds without meeting the requirement again', () => {
        const qualified = playState({ qualified: { me: true, 'bot-1': false } });
        const next = playMelds(qualified, 'me', [twoSets[0]]);

        expect(next.board!['me'].length).toBe(1);
        expect(next.hands!['me'].length).toBe(5);
      });

      it('should keep melds laid earlier', () => {
        const earlier = {
          id: 'meld-old',
          type: 'set' as const,
          rank: 'K',
          cards: [card('kh', 'hearts', 'K'), card('kd', 'diamonds', 'K'), card('kc', 'clubs', 'K')]
        };
        const state = playState({ qualified: { me: true, 'bot-1': false }, board: { me: [earlier], 'bot-1': [] } });
        const next = playMelds(state, 'me', [twoSets[0]]);

        expect(next.board!['me'].map(m => m.id)).toEqual(['meld-old', 'meld-7h']);
      });

      it('should reject cards that are not in the hand, or used twice', () => {
        expect(() => playMelds(playState(), 'me', [{ type: 'set', cardIds: ['7h', '7s', 'nope'] }])).toThrowError(/not in your hand/);
        expect(() =>
          playMelds(playState(), 'me', [twoSets[0], { type: 'set', cardIds: ['7h', '9h', '9s'] }])
        ).toThrowError(/not in your hand/);
      });

      it('should reject invalid sets and runs with a reason', () => {
        expect(() => playMelds(playState(), 'me', [{ type: 'set', cardIds: ['7h', '7s', '9h'] }])).toThrowError(/same rank/);
        expect(() => playMelds(playState(), 'me', [{ type: 'run', cardIds: ['7h', '7s', '7d'] }])).toThrowError(/at least 4/);
      });

      it('should only allow playing after drawing, and on your own turn', () => {
        expect(() => playMelds(playState({ turnPhase: 'draw' }), 'me', twoSets)).toThrowError(/Draw a card/);
        expect(() => playMelds(playState(), 'bot-1', twoSets)).toThrow();
      });

      it('should reject an empty play', () => {
        expect(() => playMelds(playState(), 'me', [])).toThrowError(/Choose cards/);
      });

      it('should end the hand when the player plays their last cards', () => {
        const hand = [...sevens, ...nines];
        const next = playMelds(playState({ hands: { me: hand, 'bot-1': [card('b1', 'spades', '4')] } }), 'me', twoSets);

        expect(isHandOver(next)).toBe(true);
        expect(next.winnerId).toBe('me');
        expect(next.turnPhase).toBe('over');
        expect(canDraw(next, 'bot-1')).toBe(false);
        expect(canDiscard(next, 'me')).toBe(false);
      });

      it('should not mutate the previous state', () => {
        const state = playState();
        playMelds(state, 'me', twoSets);
        expect(state.board!['me']).toEqual([]);
        expect(state.hands!['me'].length).toBe(8);
      });

      it('should create the table spaces when the state predates the board', () => {
        const old = playState();
        delete old.board;
        delete old.qualified;
        const next = playMelds(old, 'me', twoSets);
        expect(next.board!['me'].length).toBe(2);
      });
    });

    describe('addToMeld', () => {
      const botSet = {
        id: 'meld-bot',
        type: 'set' as const,
        rank: 'K',
        cards: [card('kh', 'hearts', 'K'), card('kd', 'diamonds', 'K'), card('kc', 'clubs', 'K')]
      };
      const botRun = {
        id: 'meld-run',
        type: 'run' as const,
        suit: 'clubs',
        low: 3,
        cards: [card('3c', 'clubs', '3'), card('4c', 'clubs', '4'), card('5c', 'clubs', '5'), card('6c', 'clubs', '6')]
      };
      const tableState = (overrides: Partial<GameState> = {}) =>
        playState({
          qualified: { me: true, 'bot-1': true },
          board: { me: [], 'bot-1': [botSet, botRun] },
          ...overrides
        });

      it('should add a card to a set another player laid down', () => {
        const next = addToMeld(tableState(), 'me', 'bot-1', 'meld-bot', ['ks']);

        expect(next.board!['bot-1'][0].cards.map(c => c.id)).toEqual(['kh', 'kd', 'kc', 'ks']);
        expect(next.hands!['me'].map(c => c.id)).not.toContain('ks');
        expect(next.board!['me']).toEqual([]);
        expect(next.turnPhase).toBe('discard');
      });

      it('should extend a run another player laid down', () => {
        const state = tableState({ hands: { me: [card('2c', 'clubs', '2'), card('7c', 'clubs', '7'), card('x', 'hearts', '9')], 'bot-1': [] } });
        const next = addToMeld(state, 'me', 'bot-1', 'meld-run', ['2c', '7c']);

        expect(next.board!['bot-1'][1].cards.map(c => c.id)).toEqual(['2c', '3c', '4c', '5c', '6c', '7c']);
        expect(next.board!['bot-1'][1].low).toBe(2);
      });

      it('should accept a joker', () => {
        const state = tableState({ hands: { me: [joker(0), card('x', 'hearts', '9')], 'bot-1': [] } });
        const next = addToMeld(state, 'me', 'bot-1', 'meld-bot', ['joker-0']);
        expect(next.board!['bot-1'][0].cards.length).toBe(4);
      });

      it('should require the player to have qualified first', () => {
        expect(() => addToMeld(tableState({ qualified: { me: false, 'bot-1': true } }), 'me', 'bot-1', 'meld-bot', ['ks'])).toThrowError(
          /Qualify/
        );
      });

      it('should reject cards that do not fit, unknown melds and missing cards', () => {
        expect(() => addToMeld(tableState(), 'me', 'bot-1', 'meld-bot', ['2c'])).toThrowError(/match/);
        expect(() => addToMeld(tableState(), 'me', 'bot-1', 'nope', ['ks'])).toThrowError(/not on the table/);
        expect(() => addToMeld(tableState(), 'me', 'bot-1', 'meld-bot', ['nope'])).toThrowError(/not in your hand/);
      });

      it('should only allow adding after drawing', () => {
        expect(() => addToMeld(tableState({ turnPhase: 'draw' }), 'me', 'bot-1', 'meld-bot', ['ks'])).toThrowError(/Draw a card/);
      });

      it('should end the hand when the last card goes onto the table', () => {
        const state = tableState({ hands: { me: [card('ks', 'spades', 'K')], 'bot-1': [] } });
        const next = addToMeld(state, 'me', 'bot-1', 'meld-bot', ['ks']);
        expect(isHandOver(next)).toBe(true);
        expect(next.winnerId).toBe('me');
      });
    });

    describe('going out by discarding', () => {
      it('should end the hand instead of passing the turn when the last card is thrown away', () => {
        const state = playState({ hands: { me: [card('ks', 'spades', 'K')], 'bot-1': [] } });
        const next = discardCard(state, 'me', 'ks');

        expect(isHandOver(next)).toBe(true);
        expect(next.winnerId).toBe('me');
        expect(next.currentTurn).toBe('me');
        expect(next.discardPile!.map(c => c.id)).toContain('ks');
      });
    });

    describe('bots on the table', () => {
      const botTurn = (hand: Card[], overrides: Partial<GameState> = {}) =>
        playState({
          currentTurn: 'bot-1',
          hands: { me: [card('m1', 'hearts', '4')], 'bot-1': hand },
          ...overrides
        });

      it('should qualify as soon as its hand allows it', () => {
        const hand = [...sevens, ...nines, card('ks', 'spades', 'K')];
        const next = playBotStep(botTurn(hand), 'bot-1');

        expect(next.qualified!['bot-1']).toBe(true);
        expect(next.board!['bot-1'].map(m => m.type)).toEqual(['set', 'set']);
        expect(next.turnPhase).toBe('discard');
        expect(next.currentTurn).toBe('bot-1');
      });

      it('should use a joker to complete a set', () => {
        const hand = [...sevens, card('9h', 'hearts', '9'), card('9s', 'spades', '9'), joker(0), card('ks', 'spades', 'K')];
        const next = playBotStep(botTurn(hand), 'bot-1');

        expect(next.qualified!['bot-1']).toBe(true);
        expect(next.board!['bot-1'].flatMap(m => m.cards.map(c => c.id))).toContain('joker-0');
      });

      it('should find a set and a run when that is what the hand needs', () => {
        const hand = [
          ...sevens,
          card('3c', 'clubs', '3'),
          card('4c', 'clubs', '4'),
          card('5c', 'clubs', '5'),
          card('6c', 'clubs', '6'),
          card('ks', 'spades', 'K')
        ];
        const next = playBotStep(botTurn(hand, { handNumber: 2 }), 'bot-1');

        expect(next.board!['bot-1'].map(m => m.type).sort()).toEqual(['run', 'set']);
      });

      it('should discard when it cannot qualify', () => {
        const hand = [card('2h', 'hearts', '2'), card('5s', 'spades', '5'), card('9d', 'diamonds', '9'), card('kc', 'clubs', 'K')];
        const next = playBotStep(botTurn(hand), 'bot-1');

        expect(next.qualified!['bot-1']).toBe(false);
        expect(next.currentTurn).toBe('me');
        expect(next.turnPhase).toBe('draw');
      });

      it('should add cards to melds on the table once qualified, then discard', () => {
        const mySet = { id: 'meld-me', type: 'set' as const, rank: 'K', cards: [card('kh', 'hearts', 'K'), card('kd', 'diamonds', 'K'), card('kc', 'clubs', 'K')] };
        const state = botTurn([card('ks', 'spades', 'K'), card('2h', 'hearts', '2'), card('9d', 'diamonds', '9')], {
          qualified: { me: true, 'bot-1': true },
          board: { me: [mySet], 'bot-1': [] }
        });

        const added = playBotStep(state, 'bot-1');
        expect(added.board!['me'][0].cards.length).toBe(4);
        expect(added.currentTurn).toBe('bot-1');

        const thrown = playBotStep(added, 'bot-1');
        expect(thrown.currentTurn).toBe('me');
      });

      it('should win the hand by playing its last cards', () => {
        const next = playBotStep(botTurn([...sevens, ...nines]), 'bot-1');

        expect(isHandOver(next)).toBe(true);
        expect(next.winnerId).toBe('bot-1');
      });
    });
  });
});

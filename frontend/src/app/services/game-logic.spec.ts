import { Card, GameState } from './lobby.service';
import {
  layOffCards,
  canDiscard,
  canDraw,
  cardPoints,
  handPoints,
  discardCard,
  drawCard,
  isHandOver,
  playBotStep,
  playMelds,
  useBid,
  acceptBid,
  offerBid,
  withdrawBid,
  cancelBid,
  declareBid,
  pendingBidder,
  selectContract,
  startNextHand,
  applyMove,
  parseMove
} from './game-logic';

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

  describe('melding and laying off', () => {
    const joker = (n: number) => card(`joker-${n}`, 'joker', 'JOKER');
    const sevens = [card('7h', 'hearts', '7'), card('7s', 'spades', '7'), card('7d', 'diamonds', '7')];
    const nines = [card('9h', 'hearts', '9'), card('9s', 'spades', '9'), card('9c', 'clubs', '9')];

    // Contract 1 requires two sets of three.
    function playState(overrides: Partial<GameState> = {}): GameState {
      return makeState({
        handNumber: 1,
        turnPhase: 'discard',
        hands: { me: [...sevens, ...nines, card('ks', 'spades', 'K'), card('2c', 'clubs', '2')], 'bot-1': [card('b1', 'spades', '4')] },
        board: { me: [], 'bot-1': [] },
        contractMelded: { me: false, 'bot-1': false },
        selectedContracts: { me: 1, 'bot-1': null },
        completedContracts: { me: [], 'bot-1': [] },
        removedContracts: { me: [], 'bot-1': [] },
        ...overrides
      });
    }

    const twoKindSets = [
      { type: 'set' as const, cardIds: ['7h', '7s', '7d'] },
      { type: 'set' as const, cardIds: ['9h', '9s', '9c'] }
    ];

    describe('playMelds', () => {
      it('should require the player to select an available contract before melding', () => {
        const state = playState({ selectedContracts: { me: null, 'bot-1': null } });
        expect(() => playMelds(state, 'me', twoKindSets)).toThrowError(/Choose an available contract/);
      });

      it('should let a player choose any contract that is still available', () => {
        const state = selectContract(playState(), 'me', 7);
        expect(state.selectedContracts!['me']).toBe(7);
        expect(() => selectContract(state, 'me', 1)).not.toThrow();
      });

      it('should meld the contract on the player\'s space of the table', () => {
        const next = playMelds(playState(), 'me', twoKindSets);

        expect(next.board!['me'].map(m => m.type)).toEqual(['set', 'set']);
        expect(next.board!['bot-1']).toEqual([]);
        expect(next.contractMelded!['me']).toBe(true);
        expect(next.completedContracts!['me']).toEqual([1]);
        expect(next.hands!['me'].map(c => c.id)).toEqual(['ks', '2c']);
        expect(next.turnPhase).toBe('discard');
        expect(next.currentTurn).toBe('me');
      });

      it('should reject a first play that does not meet the hand requirement', () => {
        expect(() => playMelds(playState(), 'me', [twoKindSets[0]])).toThrowError(/Contract 1 requires exactly 2 sets to meld the contract/);
      });

      it('should reject laying down more meld groups than the selected hand requires', () => {
        const fives = [card('5h', 'hearts', '5'), card('5s', 'spades', '5'), card('5c', 'clubs', '5')];
        const state = playState({ hands: { me: [...sevens, ...nines, ...fives], 'bot-1': [] } });
        expect(() => playMelds(state, 'me', [...twoKindSets, { type: 'set' as const, cardIds: fives.map(c => c.id) }]))
          .toThrowError(/exactly 2 sets/);
      });

      it('should expect 1 set and 1 run in round two', () => {
        const run = { type: 'run' as const, cardIds: ['4h', '5h', '6h', '7h'] };
        const hand = [card('4h', 'hearts', '4'), card('5h', 'hearts', '5'), card('6h', 'hearts', '6'), ...sevens, ...nines];
        const state = playState({
          handNumber: 2,
          selectedContracts: { me: 2, 'bot-1': null },
          hands: { me: hand, 'bot-1': [] }
        });

        expect(() => playMelds(state, 'me', [twoKindSets[1], { type: 'set', cardIds: ['7s', '7d', '7h'] }])).toThrowError(
          /1 run and 1 set/
        );
        const next = playMelds(state, 'me', [twoKindSets[1], run]);
        expect(next.board!['me'].map(m => m.type)).toEqual(['set', 'run']);
      });

      it('should let a player who has melded the contract lay further melds without meeting it again', () => {
        const contractMelded = playState({ contractMelded: { me: true, 'bot-1': false } });
        const next = playMelds(contractMelded, 'me', [twoKindSets[0]]);

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
        const state = playState({ contractMelded: { me: true, 'bot-1': false }, board: { me: [earlier], 'bot-1': [] } });
        const next = playMelds(state, 'me', [twoKindSets[0]]);

        expect(next.board!['me'].map(m => m.id)).toEqual(['meld-old', 'meld-7h']);
      });

      it('should reject cards that are not in the hand, or used twice', () => {
        expect(() => playMelds(playState(), 'me', [{ type: 'set', cardIds: ['7h', '7s', 'nope'] }])).toThrowError(/not in your hand/);
        expect(() =>
          playMelds(playState(), 'me', [twoKindSets[0], { type: 'set', cardIds: ['7h', '9h', '9s'] }])
        ).toThrowError(/not in your hand/);
      });

      it('should reject invalid sets and runs with a reason', () => {
        expect(() => playMelds(playState(), 'me', [{ type: 'set', cardIds: ['7h', '7s', '9h'] }])).toThrowError(/same rank/);
        expect(() => playMelds(playState(), 'me', [{ type: 'run', cardIds: ['7h', '7s', '7d'] }])).toThrowError(/at least 4/);
      });

      it('should only allow playing after drawing, and on your own turn', () => {
        expect(() => playMelds(playState({ turnPhase: 'draw' }), 'me', twoKindSets)).toThrowError(/Draw a card/);
        expect(() => playMelds(playState(), 'bot-1', twoKindSets)).toThrow();
      });

      it('should reject an empty play', () => {
        expect(() => playMelds(playState(), 'me', [])).toThrowError(/Choose cards/);
      });

      it('should end the hand when the player plays their last cards', () => {
        const hand = [...sevens, ...nines];
        const next = playMelds(playState({ hands: { me: hand, 'bot-1': [card('b1', 'spades', '4')] } }), 'me', twoKindSets);

        expect(isHandOver(next)).toBe(true);
        expect(next.winnerId).toBe('me');
        expect(next.turnPhase).toBe('over');
        expect(canDraw(next, 'bot-1')).toBe(false);
        expect(canDiscard(next, 'me')).toBe(false);
      });

      it('should not mutate the previous state', () => {
        const state = playState();
        playMelds(state, 'me', twoKindSets);
        expect(state.board!['me']).toEqual([]);
        expect(state.hands!['me'].length).toBe(8);
      });

      it('should create the table spaces when the state predates the board', () => {
        const old = playState();
        delete old.board;
        delete old.contractMelded;
        const next = playMelds(old, 'me', twoKindSets);
        expect(next.board!['me'].length).toBe(2);
      });
    });

    describe('layOffCards', () => {
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
          contractMelded: { me: true, 'bot-1': true },
          board: { me: [], 'bot-1': [botSet, botRun] },
          ...overrides
        });

      it('should add a card to a set another player laid down', () => {
        const next = layOffCards(tableState(), 'me', 'bot-1', 'meld-bot', ['ks']);

        expect(next.board!['bot-1'][0].cards.map(c => c.id)).toEqual(['kh', 'kd', 'kc', 'ks']);
        expect(next.hands!['me'].map(c => c.id)).not.toContain('ks');
        expect(next.board!['me']).toEqual([]);
        expect(next.turnPhase).toBe('discard');
      });

      it('should extend a run another player laid down', () => {
        const state = tableState({ hands: { me: [card('2c', 'clubs', '2'), card('7c', 'clubs', '7'), card('x', 'hearts', '9')], 'bot-1': [] } });
        const next = layOffCards(state, 'me', 'bot-1', 'meld-run', ['2c', '7c']);

        expect(next.board!['bot-1'][1].cards.map(c => c.id)).toEqual(['2c', '3c', '4c', '5c', '6c', '7c']);
        expect(next.board!['bot-1'][1].low).toBe(2);
      });

      it('should accept a joker', () => {
        const state = tableState({ hands: { me: [joker(0), card('x', 'hearts', '9')], 'bot-1': [] } });
        const next = layOffCards(state, 'me', 'bot-1', 'meld-bot', ['joker-0']);
        expect(next.board!['bot-1'][0].cards.length).toBe(4);
      });

      it('should require the player to have melded the contract first', () => {
        expect(() => layOffCards(tableState({ contractMelded: { me: false, 'bot-1': true } }), 'me', 'bot-1', 'meld-bot', ['ks'])).toThrowError(
          /Meld the contract/
        );
      });

      it('should reject cards that do not fit, unknown melds and missing cards', () => {
        expect(() => layOffCards(tableState(), 'me', 'bot-1', 'meld-bot', ['2c'])).toThrowError(/match/);
        expect(() => layOffCards(tableState(), 'me', 'bot-1', 'nope', ['ks'])).toThrowError(/not on the table/);
        expect(() => layOffCards(tableState(), 'me', 'bot-1', 'meld-bot', ['nope'])).toThrowError(/not in your hand/);
      });

      it('should only allow adding after drawing', () => {
        expect(() => layOffCards(tableState({ turnPhase: 'draw' }), 'me', 'bot-1', 'meld-bot', ['ks'])).toThrowError(/Draw a card/);
      });

      it('should end the hand when the last card goes onto the table', () => {
        const state = tableState({ hands: { me: [card('ks', 'spades', 'K')], 'bot-1': [] } });
        const next = layOffCards(state, 'me', 'bot-1', 'meld-bot', ['ks']);
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

    describe('round progression', () => {
      it('should remove the easiest remaining contract when players have not melded it by the end', () => {
        const state = playState({
          turnPhase: 'discard',
          hands: { me: [card('last', 'spades', 'K')], 'bot-1': [card('b', 'clubs', '4')] }
        });
        const ended = discardCard(state, 'me', 'last');
        expect(ended.removedContracts).toEqual({ me: [1], 'bot-1': [1] });
      });

      it('should deal the next round while preserving completed and removed contracts', () => {
        const state = playState({
          turnPhase: 'discard',
          hands: { me: [card('last', 'spades', 'K')], 'bot-1': [card('b', 'clubs', '4')] }
        });
        const next = startNextHand(discardCard(state, 'me', 'last'));

        expect(next.handNumber).toBe(2);
        expect(next.phase).toBe('playing');
        expect(next.currentTurn).toBe('bot-1');
        expect(next.turnPhase).toBe('draw');
        expect(next.hands!['me']).toHaveSize(11);
        expect(next.hands!['bot-1']).toHaveSize(11);
        expect(next.contractMelded).toEqual({ me: false, 'bot-1': false });
        expect(next.selectedContracts).toEqual({ me: null, 'bot-1': null });
        expect(next.removedContracts).toEqual({ me: [1], 'bot-1': [1] });
      });
    });

    describe('bots on the table', () => {
      const botTurn = (hand: Card[], overrides: Partial<GameState> = {}) =>
        playState({
          currentTurn: 'bot-1',
          hands: { me: [card('m1', 'hearts', '4')], 'bot-1': hand },
          ...overrides
        });

      it('should meld its contract as soon as its hand allows it', () => {
        const hand = [...sevens, ...nines, card('ks', 'spades', 'K')];
        const next = playBotStep(botTurn(hand), 'bot-1');

        expect(next.contractMelded!['bot-1']).toBe(true);
        expect(next.board!['bot-1'].map(m => m.type)).toEqual(['set', 'set']);
        expect(next.turnPhase).toBe('discard');
        expect(next.currentTurn).toBe('bot-1');
      });

      it('should use a joker to complete a set', () => {
        const hand = [...sevens, card('9h', 'hearts', '9'), card('9s', 'spades', '9'), joker(0), card('ks', 'spades', 'K')];
        const next = playBotStep(botTurn(hand), 'bot-1');

        expect(next.contractMelded!['bot-1']).toBe(true);
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

      it('should discard when it cannot meld its contract', () => {
        const hand = [card('2h', 'hearts', '2'), card('5s', 'spades', '5'), card('9d', 'diamonds', '9'), card('kc', 'clubs', 'K')];
        const next = playBotStep(botTurn(hand), 'bot-1');

        expect(next.contractMelded!['bot-1']).toBe(false);
        expect(next.currentTurn).toBe('me');
        expect(next.turnPhase).toBe('draw');
      });

      it('should lay off cards onto melds after melding its contract, then discard', () => {
        const mySet = { id: 'meld-me', type: 'set' as const, rank: 'K', cards: [card('kh', 'hearts', 'K'), card('kd', 'diamonds', 'K'), card('kc', 'clubs', 'K')] };
        const state = botTurn([card('ks', 'spades', 'K'), card('2h', 'hearts', '2'), card('9d', 'diamonds', '9')], {
          contractMelded: { me: true, 'bot-1': true },
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

describe('scoring', () => {
  it('should value cards by face, J-K 10, Ace 11, Joker 15', () => {
    expect(cardPoints(card('a', 'hearts', '7'))).toBe(7);
    expect(cardPoints(card('b', 'hearts', 'Q'))).toBe(10);
    expect(cardPoints(card('c', 'hearts', 'A'))).toBe(11);
    expect(cardPoints(card('d', 'joker', 'JOKER'))).toBe(15);
    expect(handPoints([card('a', 'hearts', '7'), card('c', 'hearts', 'A')])).toBe(18);
  });

  it('should give the winner 0 and add remaining hand points to others', () => {
    const state = makeState({
      hands: { me: [card('m1', 'hearts', '4')], 'bot-1': [card('b1', 'spades', 'K'), card('b2', 'spades', '3')] },
      turnPhase: 'discard',
      scores: { me: 5, 'bot-1': 20 }
    });
    const next = discardCard(state, 'me', 'm1');
    expect(next.scores).toEqual({ me: 5, 'bot-1': 33 });
  });
});

describe('bids', () => {
  it('should spend up to three bids per hand and then reject', () => {
    let state = makeState();
    for (let i = 0; i < 3; i++) {
      state = useBid(state, 'me');
    }
    expect(state.bidsUsed?.['me']).toBe(3);
    expect(() => useBid(state, 'me')).toThrow();
  });
});

describe('bid intents', () => {
  it('should limit declared bids to three', () => {
    let state = makeState();
    ['2', '3', '4'].forEach(r => (state = declareBid(state, 'bot-1', 'hearts', r)));
    expect(() => declareBid(state, 'bot-1', 'hearts', '5')).toThrow();
  });

  it('should give the bidder the face-up card and top mystery card, then chain bids', () => {
    let state = makeState({ discardPile: [card('x0', 'clubs', '2'), card('x1', 'hearts', '3'), card('x2', 'diamonds', 'Q')] });
    state = declareBid(state, 'bot-1', 'diamonds', 'Q');
    state = declareBid(state, 'bot-1', 'hearts', '3');
    expect(pendingBidder(state)).toBe('bot-1');
    expect(() => acceptBid(state)).toThrow();
    state = acceptBid(offerBid(state));
    expect(state.hands?.['bot-1'].map(c => c.id).slice(-2)).toEqual(['x2', 'd1']);
    expect(state.bidsUsed?.['bot-1']).toBe(1);
    expect(pendingBidder(state)).toBe('bot-1');
    state = acceptBid(offerBid(state));
    expect(state.bidsUsed?.['bot-1']).toBe(2);
    expect(state.bidIntents?.['bot-1']).toEqual([]);
    expect(pendingBidder(state)).toBeNull();
  });

  it('should let the bidder withdraw an offered bid without any transfer', () => {
    let state = declareBid(makeState(), 'bot-1', 'diamonds', 'Q');
    state = offerBid(state);
    expect(canDraw(state, 'me')).toBeFalse();
    state = withdrawBid(state, 'bot-1');
    expect(state.bidsUsed?.['bot-1'] ?? 0).toBe(0);
    expect(state.hands?.['bot-1'].length).toBe(4);
    expect(state.bidIntents?.['bot-1']).toEqual([]);
    expect(canDraw(state, 'me')).toBeTrue();
  });

  it('should allow three declared bids even after bids were used', () => {
    let state = useBid(makeState(), 'me');
    ['2', '3', '4'].forEach(r => (state = declareBid(state, 'me', 'hearts', r)));
    expect(state.bidIntents?.['me'].length).toBe(3);
  });

  it('should not let a player with a melded contract bid', () => {
    const state = makeState({ contractMelded: { me: false, 'bot-1': true } });
    expect(() => declareBid(state, 'bot-1', 'diamonds', 'Q')).toThrow();
    const declared = { ...declareBid(makeState(), 'bot-1', 'diamonds', 'Q'), contractMelded: { me: false, 'bot-1': true } };
    expect(pendingBidder(declared)).toBeNull();
  });

  it('should not let the current player bid against themselves', () => {
    const state = declareBid(makeState(), 'me', 'diamonds', 'Q');
    expect(pendingBidder(state)).toBeNull();
  });

  it('should give declared bids deterministic ids', () => {
    const first = declareBid(makeState(), 'bot-1', 'diamonds', 'Q');
    const second = declareBid(makeState(), 'bot-1', 'diamonds', 'Q');
    expect(first.bidIntents?.['bot-1'][0].id).toBe(second.bidIntents?.['bot-1'][0].id);
  });

  it('should keep bid ids unique when a bid is cancelled and the same face is declared again', () => {
    let state = declareBid(makeState(), 'bot-1', 'hearts', '2');
    state = declareBid(state, 'bot-1', 'hearts', '2');
    const [firstId, secondId] = state.bidIntents!['bot-1'].map(c => c.id);
    expect(firstId).not.toBe(secondId);

    state = cancelBid(state, 'bot-1', firstId);
    state = declareBid(state, 'bot-1', 'hearts', '2');
    const ids = state.bidIntents!['bot-1'].map(c => c.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids).toContain(secondId);
  });

  it('should accept a joker bid but reject faces that are not on a card', () => {
    expect(declareBid(makeState(), 'me', 'joker', 'JOKER').bidIntents?.['me'][0]).toEqual(
      jasmine.objectContaining({ suit: 'joker', rank: 'JOKER' })
    );
    [['hearts', 'JOKER'], ['joker', 'A'], ['stars', 'A'], ['hearts', '11'], ['constructor', 'A'], ['hearts', '__proto__']].forEach(
      ([suit, rank]) => expect(() => declareBid(makeState(), 'me', suit, rank)).toThrow()
    );
  });
});

describe('parseMove', () => {
  it('should accept every move type a player may send', () => {
    const moves: unknown[] = [
      { type: 'draw', source: 'deck' },
      { type: 'draw', source: 'discard' },
      { type: 'discard', cardId: 'c1' },
      { type: 'meld', groups: [{ type: 'set', cardIds: ['a', 'b', 'c'] }, { type: 'run', cardIds: ['d', 'e', 'f', 'g'] }] },
      { type: 'layOff', ownerId: 'bot-1', meldId: 'meld-1', cardIds: ['a'] },
      { type: 'selectContract', round: 3 },
      { type: 'declareBid', suit: 'hearts', rank: '10' },
      { type: 'declareBid', suit: 'joker', rank: 'JOKER' },
      { type: 'cancelBid', bidId: 'bid-me-hearts-2-1' },
      { type: 'offerBid' },
      { type: 'acceptBid' },
      { type: 'withdrawBid' }
    ];
    moves.forEach(move => expect(parseMove(move)).toEqual(move as never));
  });

  it('should drop properties that are not part of the move', () => {
    expect(parseMove({ type: 'discard', cardId: 'c1', playerId: 'someone-else', extra: { deep: true } }))
      .toEqual({ type: 'discard', cardId: 'c1' });
    expect(parseMove({ type: 'offerBid', playerId: 'someone-else' })).toEqual({ type: 'offerBid' });
  });

  it('should reject input that is not a known move', () => {
    [
      undefined, null, 42, 'draw', [], {}, { type: 5 }, { type: 'nextHand' }, { type: 'startNextHand' },
      { type: '__proto__' }, { type: 'constructor' }, { fn: 'drawCard', args: ['me', 'deck'] }
    ].forEach(value => expect(parseMove(value)).withContext(JSON.stringify(value)).toBeNull());
  });

  it('should reject moves with malformed or oversized fields', () => {
    const tooLong = 'x'.repeat(129);
    [
      { type: 'draw', source: 'hand' },
      { type: 'draw' },
      { type: 'discard' },
      { type: 'discard', cardId: '' },
      { type: 'discard', cardId: 7 },
      { type: 'discard', cardId: tooLong },
      { type: 'meld', groups: [] },
      { type: 'meld', groups: 'set' },
      { type: 'meld', groups: [null] },
      { type: 'meld', groups: [{ type: 'pair', cardIds: ['a', 'b'] }] },
      { type: 'meld', groups: [{ type: 'set', cardIds: [] }] },
      { type: 'meld', groups: [{ type: 'set', cardIds: ['a', 3, 'c'] }] },
      { type: 'meld', groups: Array.from({ length: 13 }, () => ({ type: 'set', cardIds: ['a', 'b', 'c'] })) },
      { type: 'meld', groups: [{ type: 'set', cardIds: Array.from({ length: 31 }, (_, i) => `c${i}`) }] },
      { type: 'layOff', ownerId: 'bot-1', meldId: 'meld-1' },
      { type: 'layOff', ownerId: 'bot-1', meldId: 'meld-1', cardIds: [] },
      { type: 'layOff', ownerId: 1, meldId: 'meld-1', cardIds: ['a'] },
      { type: 'selectContract', round: 0 },
      { type: 'selectContract', round: 8 },
      { type: 'selectContract', round: 1.5 },
      { type: 'selectContract', round: '3' },
      { type: 'declareBid', suit: 'hearts', rank: 'JOKER' },
      { type: 'declareBid', suit: 'hearts' },
      { type: 'declareBid', suit: 1, rank: 2 },
      { type: 'cancelBid' },
      { type: 'cancelBid', bidId: tooLong }
    ].forEach(value => expect(parseMove(value)).withContext(JSON.stringify(value).slice(0, 80)).toBeNull());
  });
});

describe('applyMove', () => {
  it('should reject a player who is not at the table', () => {
    expect(() => applyMove(makeState(), 'stranger', { type: 'draw', source: 'deck' })).toThrowError(/not part of this game/);
  });

  it('should apply the same rules as the underlying game functions', () => {
    const drawn = applyMove(makeState(), 'me', { type: 'draw', source: 'deck' });
    expect(drawn).toEqual(drawCard(makeState(), 'me', 'deck'));

    const thrown = applyMove(drawn, 'me', { type: 'discard', cardId: 'm1' });
    expect(thrown.currentTurn).toBe('bot-1');
    expect(thrown.discardPile!.map(c => c.id)).toContain('m1');
  });

  it('should reject moves made out of turn', () => {
    expect(() => applyMove(makeState(), 'bot-1', { type: 'draw', source: 'deck' })).toThrow();
    expect(() => applyMove(makeState({ turnPhase: 'discard' }), 'bot-1', { type: 'discard', cardId: 'b1' })).toThrow();
  });

  it('should meld and lay off through the same validation as local play', () => {
    const sevens = [card('7h', 'hearts', '7'), card('7s', 'spades', '7'), card('7d', 'diamonds', '7')];
    const nines = [card('9h', 'hearts', '9'), card('9s', 'spades', '9'), card('9c', 'clubs', '9')];
    const state = makeState({
      handNumber: 1,
      turnPhase: 'discard',
      hands: { me: [...sevens, ...nines, card('ks', 'spades', 'K')], 'bot-1': [card('b1', 'spades', '4')] },
      board: { me: [], 'bot-1': [] },
      contractMelded: { me: false, 'bot-1': false },
      selectedContracts: { me: 1, 'bot-1': null },
      completedContracts: { me: [], 'bot-1': [] },
      removedContracts: { me: [], 'bot-1': [] }
    });
    const melded = applyMove(state, 'me', {
      type: 'meld',
      groups: [{ type: 'set', cardIds: ['7h', '7s', '7d'] }, { type: 'set', cardIds: ['9h', '9s', '9c'] }]
    });
    expect(melded.contractMelded!['me']).toBeTrue();
    expect(() => applyMove(melded, 'me', { type: 'meld', groups: [{ type: 'set', cardIds: ['7h', '7s', '7d'] }] })).toThrow();

    const kings = [card('kh', 'hearts', 'K'), card('kd', 'diamonds', 'K'), card('kc', 'clubs', 'K')];
    const withTable = { ...melded, board: { ...melded.board, 'bot-1': [{ id: 'meld-k', type: 'set' as const, rank: 'K', cards: kings }] } };
    const laidOff = applyMove(withTable, 'me', { type: 'layOff', ownerId: 'bot-1', meldId: 'meld-k', cardIds: ['ks'] });
    expect(laidOff.board!['bot-1'][0].cards.length).toBe(4);
    expect(() => applyMove(withTable, 'me', { type: 'layOff', ownerId: 'nobody', meldId: 'meld-k', cardIds: ['ks'] })).toThrow();
  });

  it('should let a player choose a contract for themselves only', () => {
    const state = makeState({ completedContracts: { me: [], 'bot-1': [] }, removedContracts: { me: [], 'bot-1': [] } });
    const next = applyMove(state, 'bot-1', { type: 'selectContract', round: 4 });
    expect(next.selectedContracts?.['bot-1']).toBe(4);
    expect(next.selectedContracts?.['me']).toBeUndefined();
  });

  describe('bidding', () => {
    // bot-1 has declared a bid on the face-up queen of diamonds while it is "me"'s turn to draw
    const biddingState = () => declareBid(makeState(), 'bot-1', 'diamonds', 'Q');

    it('should let only the current player allow a bid', () => {
      expect(() => applyMove(biddingState(), 'bot-1', { type: 'offerBid' })).toThrowError(/current player/);
      expect(applyMove(biddingState(), 'me', { type: 'offerBid' }).bidOffer).toEqual({ bidderId: 'bot-1' });
    });

    it('should let only the bidder accept or withdraw an offered bid', () => {
      const offered = applyMove(biddingState(), 'me', { type: 'offerBid' });
      expect(() => applyMove(offered, 'me', { type: 'acceptBid' })).toThrow();
      expect(() => applyMove(offered, 'me', { type: 'withdrawBid' })).toThrow();

      const accepted = applyMove(offered, 'bot-1', { type: 'acceptBid' });
      expect(accepted.bidsUsed?.['bot-1']).toBe(1);
      expect(accepted.bidOffer).toBeUndefined();

      const withdrawn = applyMove(offered, 'bot-1', { type: 'withdrawBid' });
      expect(withdrawn.bidOffer).toBeUndefined();
      expect(withdrawn.bidsUsed?.['bot-1'] ?? 0).toBe(0);
    });

    it('should only cancel the sender\'s own bid', () => {
      const state = declareBid(biddingState(), 'me', 'hearts', '2');
      const bidId = state.bidIntents!['bot-1'][0].id;
      const next = applyMove(state, 'me', { type: 'cancelBid', bidId });
      expect(next.bidIntents!['bot-1'].length).toBe(1);
    });
  });
});

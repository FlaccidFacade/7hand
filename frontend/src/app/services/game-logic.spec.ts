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
  declareBid,
  pendingBidder,
  selectContract,
  startNextHand
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
});

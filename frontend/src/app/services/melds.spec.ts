import { Card, Meld } from './lobby.service';
import { addCardsToMeld, buildRun, buildSet, describeRequirement, rankName, requirementFor } from './melds';

const c = (id: string, suit: string, rank: string): Card => ({ id, suit, rank });
const joker = (n: number): Card => c(`joker-${n}`, 'joker', 'JOKER');
const ids = (meld: Meld) => meld.cards.map(card => card.id);

function ok(result: { meld: Meld } | { error: string }): Meld {
  if ('error' in result) {
    throw new Error(`Expected a meld but got: ${result.error}`);
  }
  return result.meld;
}

function failure(result: { meld: Meld } | { error: string }): string {
  if ('meld' in result) {
    throw new Error('Expected an error');
  }
  return result.error;
}

describe('melds', () => {
  describe('requirements', () => {
    it('should follow the qualified board table from the rules', () => {
      expect([1, 2, 3, 4, 5, 6, 7].map(n => requirementFor(n))).toEqual([
        { sets: 2, runs: 0 },
        { sets: 1, runs: 1 },
        { sets: 0, runs: 2 },
        { sets: 3, runs: 0 },
        { sets: 2, runs: 1 },
        { sets: 1, runs: 2 },
        { sets: 0, runs: 3 }
      ]);
    });

    it('should clamp hand numbers outside 1-7', () => {
      expect(requirementFor(0)).toEqual(requirementFor(1));
      expect(requirementFor(9)).toEqual(requirementFor(7));
    });

    it('should describe a requirement in words', () => {
      expect(describeRequirement({ sets: 2, runs: 0 })).toBe('two sets');
      expect(describeRequirement({ sets: 1, runs: 1 })).toBe('one set and one run');
      expect(describeRequirement({ sets: 1, runs: 2 })).toBe('one set and two runs');
      expect(describeRequirement({ sets: 0, runs: 3 })).toBe('three runs');
    });

    it('should name ranks, with 14 meaning an ace high', () => {
      expect(rankName(1)).toBe('A');
      expect(rankName(14)).toBe('A');
      expect(rankName(11)).toBe('J');
    });
  });

  describe('buildSet', () => {
    it('should accept three or more cards of the same rank in any suits', () => {
      const meld = ok(buildSet([c('a', 'hearts', '7'), c('b', 'spades', '7'), c('c', 'hearts', '7')]));
      expect(meld.type).toBe('set');
      expect(meld.rank).toBe('7');
    });

    it('should accept a joker standing in for a card', () => {
      const meld = ok(buildSet([joker(0), c('a', 'hearts', '7'), c('b', 'spades', '7')]));
      expect(ids(meld)).toEqual(['a', 'b', 'joker-0']);
    });

    it('should reject fewer than three cards', () => {
      expect(failure(buildSet([c('a', 'hearts', '7'), c('b', 'spades', '7')]))).toContain('at least 3');
    });

    it('should reject mixed ranks', () => {
      expect(failure(buildSet([c('a', 'hearts', '7'), c('b', 'spades', '7'), c('c', 'hearts', '8')]))).toContain(
        'same rank'
      );
    });

    it('should reject more jokers than real cards', () => {
      expect(failure(buildSet([c('a', 'hearts', '7'), joker(0), joker(1)]))).toContain('jokers');
    });
  });

  describe('buildRun', () => {
    it('should accept four consecutive cards of one suit and order them', () => {
      const meld = ok(buildRun([c('7', 'hearts', '7'), c('4', 'hearts', '4'), c('6', 'hearts', '6'), c('5', 'hearts', '5')]));
      expect(ids(meld)).toEqual(['4', '5', '6', '7']);
      expect(meld.low).toBe(4);
      expect(meld.suit).toBe('hearts');
    });

    it('should fill a gap with a joker', () => {
      const meld = ok(buildRun([c('4', 'clubs', '4'), joker(0), c('6', 'clubs', '6'), c('7', 'clubs', '7')]));
      expect(ids(meld)).toEqual(['4', 'joker-0', '6', '7']);
      expect(meld.low).toBe(4);
    });

    it('should extend upwards with a spare joker', () => {
      const meld = ok(buildRun([c('4', 'clubs', '4'), c('5', 'clubs', '5'), c('6', 'clubs', '6'), joker(0)]));
      expect(ids(meld)).toEqual(['4', '5', '6', 'joker-0']);
      expect(meld.low).toBe(4);
    });

    it('should extend downwards when the run already ends at the ace', () => {
      const meld = ok(buildRun([c('q', 'spades', 'Q'), c('k', 'spades', 'K'), c('a', 'spades', 'A'), joker(0)]));
      expect(ids(meld)).toEqual(['joker-0', 'q', 'k', 'a']);
      expect(meld.low).toBe(11);
    });

    it('should allow a low ace', () => {
      const meld = ok(buildRun([c('a', 'hearts', 'A'), c('2', 'hearts', '2'), c('3', 'hearts', '3'), c('4', 'hearts', '4')]));
      expect(meld.low).toBe(1);
      expect(ids(meld)).toEqual(['a', '2', '3', '4']);
    });

    it('should allow a high ace', () => {
      const meld = ok(buildRun([c('j', 'hearts', 'J'), c('q', 'hearts', 'Q'), c('k', 'hearts', 'K'), c('a', 'hearts', 'A')]));
      expect(meld.low).toBe(11);
      expect(ids(meld)).toEqual(['j', 'q', 'k', 'a']);
    });

    it('should not let a run wrap round from king to ace to two', () => {
      const wrap = [c('q', 'hearts', 'Q'), c('k', 'hearts', 'K'), c('a', 'hearts', 'A'), c('2', 'hearts', '2')];
      expect(failure(buildRun(wrap))).toContain('don\'t make a run');
    });

    it('should reject fewer than four cards', () => {
      expect(failure(buildRun([c('4', 'hearts', '4'), c('5', 'hearts', '5'), c('6', 'hearts', '6')]))).toContain('at least 4');
    });

    it('should reject mixed suits', () => {
      const cards = [c('4', 'hearts', '4'), c('5', 'spades', '5'), c('6', 'hearts', '6'), c('7', 'hearts', '7')];
      expect(failure(buildRun(cards))).toContain('same suit');
    });

    it('should reject a repeated card', () => {
      const cards = [c('4', 'hearts', '4'), c('4b', 'hearts', '4'), c('5', 'hearts', '5'), c('6', 'hearts', '6')];
      expect(failure(buildRun(cards))).toContain('repeat');
    });

    it('should reject cards that leave a gap with no joker to fill it', () => {
      const cards = [c('4', 'hearts', '4'), c('5', 'hearts', '5'), c('7', 'hearts', '7'), c('8', 'hearts', '8')];
      expect(failure(buildRun(cards))).toContain('don\'t make a run');
    });

    it('should reject more jokers than real cards', () => {
      const cards = [c('4', 'hearts', '4'), joker(0), joker(1), joker(2)];
      expect(failure(buildRun(cards))).toContain('jokers');
    });
  });

  describe('addCardsToMeld', () => {
    const set = () => ok(buildSet([c('a', 'hearts', '7'), c('b', 'spades', '7'), c('c', 'clubs', '7')]));
    const run = () => ok(buildRun([c('5', 'hearts', '5'), c('6', 'hearts', '6'), c('7', 'hearts', '7'), c('8', 'hearts', '8')]));

    it('should add a matching card to a set', () => {
      expect(ids(ok(addCardsToMeld(set(), [c('d', 'diamonds', '7')])))).toEqual(['a', 'b', 'c', 'd']);
    });

    it('should add a joker to a set', () => {
      expect(ids(ok(addCardsToMeld(set(), [joker(0)])))).toContain('joker-0');
    });

    it('should reject a card of another rank for a set', () => {
      expect(failure(addCardsToMeld(set(), [c('x', 'hearts', '8')]))).toContain('match');
    });

    it('should reject a joker that would outnumber the real cards', () => {
      const withJoker = ok(buildSet([c('a', 'hearts', '7'), c('b', 'spades', '7'), joker(0)]));
      const full = ok(addCardsToMeld(withJoker, [joker(1)]));
      expect(full.cards.length).toBe(4);
      expect(failure(addCardsToMeld(full, [joker(2)]))).toContain('jokers');
    });

    it('should extend a run at the top', () => {
      const meld = ok(addCardsToMeld(run(), [c('9', 'hearts', '9')]));
      expect(ids(meld)).toEqual(['5', '6', '7', '8', '9']);
      expect(meld.low).toBe(5);
    });

    it('should extend a run at the bottom', () => {
      const meld = ok(addCardsToMeld(run(), [c('4', 'hearts', '4')]));
      expect(ids(meld)).toEqual(['4', '5', '6', '7', '8']);
      expect(meld.low).toBe(4);
    });

    it('should extend at both ends with several cards in any order', () => {
      const meld = ok(addCardsToMeld(run(), [c('10', 'hearts', '10'), c('4', 'hearts', '4'), c('9', 'hearts', '9')]));
      expect(ids(meld)).toEqual(['4', '5', '6', '7', '8', '9', '10']);
      expect(meld.low).toBe(4);
    });

    it('should place real cards before jokers so the joker does not take their spot', () => {
      const meld = ok(addCardsToMeld(run(), [joker(0), c('9', 'hearts', '9')]));
      expect(ids(meld)).toEqual(['5', '6', '7', '8', '9', 'joker-0']);
    });

    it('should accept an ace after a king and before a two', () => {
      const high = ok(buildRun([c('9', 'spades', '9'), c('10', 'spades', '10'), c('j', 'spades', 'J'), c('q', 'spades', 'Q')]));
      const withKing = ok(addCardsToMeld(high, [c('k', 'spades', 'K')]));
      expect(ids(ok(addCardsToMeld(withKing, [c('a', 'spades', 'A')])))).toContain('a');

      const low = ok(buildRun([c('2', 'spades', '2'), c('3', 'spades', '3'), c('4', 'spades', '4'), c('5', 'spades', '5')]));
      const lowAce = ok(addCardsToMeld(low, [c('a', 'spades', 'A')]));
      expect(lowAce.low).toBe(1);
    });

    it('should reject a card that leaves a gap, or is the wrong suit', () => {
      expect(failure(addCardsToMeld(run(), [c('10', 'hearts', '10')]))).toContain('extend');
      expect(failure(addCardsToMeld(run(), [c('9', 'spades', '9')]))).toContain('extend');
    });

    it('should not mutate the meld it extends', () => {
      const original = run();
      addCardsToMeld(original, [c('9', 'hearts', '9')]);
      expect(original.cards.length).toBe(4);
    });

    it('should ask for cards when none are given', () => {
      expect(failure(addCardsToMeld(run(), []))).toContain('Select');
    });
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BoardComponent, BoardSpace } from './board.component';
import { Card, Meld } from '../../services/lobby.service';

const card = (id: string, suit: string, rank: string): Card => ({ id, suit, rank });

const set: Meld = {
  id: 'meld-s',
  type: 'set',
  rank: '7',
  cards: [card('a', 'hearts', '7'), card('b', 'spades', '7'), card('j', 'joker', 'JOKER')]
};
const run: Meld = {
  id: 'meld-r',
  type: 'run',
  suit: 'hearts',
  low: 4,
  cards: [card('c', 'hearts', '4'), card('d', 'joker', 'JOKER'), card('e', 'hearts', '6'), card('f', 'hearts', '7')]
};

const spaces: BoardSpace[] = [
  { playerId: 'me', name: 'Me', isMe: true, isBot: false, qualified: true, melds: [set, run] },
  { playerId: 'bot-1', name: 'Bot 1', isMe: false, isBot: true, qualified: false, melds: [] }
];

describe('BoardComponent', () => {
  let fixture: ComponentFixture<BoardComponent>;
  let component: BoardComponent;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [BoardComponent] }).compileComponents();
    fixture = TestBed.createComponent(BoardComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.componentRef.setInput('spaces', spaces);
    fixture.detectChanges();
  });

  it('should render one space per player', () => {
    expect(el.querySelectorAll('.space').length).toBe(2);
    expect(el.querySelector('.space[data-player-id="bot-1"] .space-name')?.textContent).toContain('Bot 1');
  });

  it('should show the sets and runs a player has played', () => {
    const melds = el.querySelectorAll('.space[data-player-id="me"] .meld');
    expect(melds.length).toBe(2);
    expect(melds[0].querySelectorAll('app-playing-card').length).toBe(3);
    expect(melds[1].querySelectorAll('app-playing-card').length).toBe(4);
  });

  it('should show an empty space and a qualified badge where appropriate', () => {
    expect(el.querySelector('.space[data-player-id="bot-1"] .empty')).not.toBeNull();
    expect(el.querySelector('.space[data-player-id="me"] .badge')).not.toBeNull();
    expect(el.querySelector('.space[data-player-id="bot-1"] .badge')).toBeNull();
  });

  it('should label sets and runs', () => {
    expect(component.meldLabel(set)).toBe('Set of 7s');
    expect(component.meldLabel(run)).toBe('Run ♥ 4-7');
  });

  it('should say which card a joker stands in for', () => {
    expect(component.cardTitle(set, 2)).toBe('Joker standing in for 7');
    expect(component.cardTitle(run, 1)).toBe('Joker standing in for 5');
    expect(component.cardTitle(run, 0)).toBeNull();
  });

  it('should only emit meld clicks while melds are targetable', () => {
    const emitted: unknown[] = [];
    component.meldSelected.subscribe(target => emitted.push(target));
    const meld = el.querySelector('.space[data-player-id="me"] .meld') as HTMLButtonElement;

    meld.click();
    expect(emitted.length).toBe(0);

    fixture.componentRef.setInput('targetable', true);
    fixture.detectChanges();
    meld.click();

    expect(emitted).toEqual([{ ownerId: 'me', meldId: 'meld-s' }]);
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Lobby } from './lobby';
import { of, throwError } from 'rxjs';
import { LobbyService } from '../../services/lobby.service';
import { PlayingCardComponent } from '../playing-card/playing-card.component';

describe('Lobby', () => {
  let component: Lobby;
  let fixture: ComponentFixture<Lobby>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockActivatedRoute: any;

  beforeEach(async () => {
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);
    mockActivatedRoute = {
      snapshot: {
        paramMap: {
          get: jasmine.createSpy('get').and.returnValue('test-lobby-id')
        }
      }
    };

    await TestBed.configureTestingModule({
      imports: [Lobby],
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Lobby);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load lobby id from route', () => {
    fixture.detectChanges();
    expect(component.lobbyId).toBe('test-lobby-id');
  });

  it('should identify empty seats', () => {
    component.players = [
      { id: '1', username: 'player1', displayName: 'Player 1', position: 0 },
      { id: '2', username: 'player2', displayName: 'Player 2', position: 2 }
    ];

    const emptySeats = component.getEmptySeats();
    expect(emptySeats).toEqual([1, 3, 4, 5]);
  });

  it('should get player at position', () => {
    const player = { id: '1', username: 'player1', displayName: 'Player 1', position: 0 };
    component.players = [player];

    expect(component.getPlayerAtPosition(0)).toEqual(player);
    expect(component.getPlayerAtPosition(1)).toBeNull();
  });

  it('should check if position is occupied', () => {
    component.players = [
      { id: '1', username: 'player1', displayName: 'Player 1', position: 0 }
    ];

    expect(component.isPositionOccupied(0)).toBe(true);
    expect(component.isPositionOccupied(1)).toBe(false);
  });

  it('should navigate away on leave', () => {
    component.leaveLobby();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should identify host correctly', () => {
    component.currentUserId = '1';
    component.players = [
      { id: '1', username: 'player1', displayName: 'Player 1', position: 0 },
      { id: '2', username: 'player2', displayName: 'Player 2', position: 1 }
    ];
    component.loadLobby();
    
    expect(component.isHost).toBe(true);
  });

  describe('bot game', () => {
    let lobbyService: LobbyService;

    const startedLobby = {
      lobbyId: 'test-lobby-id',
      started: true,
      users: [
        { id: 'host', username: 'host', displayName: 'Host', position: 0 },
        { id: 'bot-1', username: 'bot1', displayName: 'Bot 1', position: 1, isBot: true }
      ],
      gamestate: { botGame: true, handNumber: 1, totalHands: 7, currentTurn: 'host' }
    };

    beforeEach(() => {
      lobbyService = TestBed.inject(LobbyService);
      spyOn(lobbyService, 'getLobby').and.returnValue(of({ lobbyId: 'test-lobby-id', users: [] }));
      component.lobbyId = 'test-lobby-id';
      component.currentUserId = 'host';
    });

    afterEach(() => {
      component.ngOnDestroy();
    });

    it('should start a bot game through the service', () => {
      const spy = spyOn(lobbyService, 'startBotGame').and.callFake(() => {
        lobbyService.updateLobby(startedLobby);
        return of(startedLobby);
      });
      component.ngOnInit();
      lobbyService.updateLobby({ lobbyId: 'test-lobby-id', users: [{ id: 'host', username: 'host', displayName: 'Host' }] });
      expect(component.canStartBotGame).toBe(true);

      component.startBotGame();

      expect(spy).toHaveBeenCalledWith('test-lobby-id', 'host');
      expect(component.isStarted).toBe(true);
      expect(component.isBotGame).toBe(true);
      expect(component.players.length).toBe(2);
      expect(component.players[1].isBot).toBe(true);
      expect(component.canStartBotGame).toBe(false);
    });

    it('should show the bot game button by default and create a lobby when not hosting one', () => {
      component.ngOnInit();
      expect(component.canStartBotGame).toBe(true);

      const createSpy = spyOn(lobbyService, 'createLobby').and.returnValue(
        of({ lobbyId: 'new-lobby', users: [{ id: 'host', username: 'host', displayName: 'Host' }] })
      );
      const startSpy = spyOn(lobbyService, 'startBotGame').and.callFake(() => {
        lobbyService.updateLobby({ ...startedLobby, lobbyId: 'new-lobby' });
        return of({ ...startedLobby, lobbyId: 'new-lobby' });
      });

      component.startBotGame();

      expect(createSpy).toHaveBeenCalledWith('host');
      expect(startSpy).toHaveBeenCalledWith('new-lobby', 'host');
      expect(component.lobbyId).toBe('new-lobby');
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/lobby', 'new-lobby'], { replaceUrl: true });
      expect(component.isStarted).toBe(true);
    });

    it('should derive labels from the game state', () => {
      component.ngOnInit();
      lobbyService.updateLobby(startedLobby);
      expect(component.handLabel).toBe('Hand 1 of 7');
      expect(component.statusLabel).toBe("Hand 1 of 7 - Host's turn");
    });

    it('should show waiting labels before the game starts', () => {
      component.ngOnInit();
      lobbyService.updateLobby({ lobbyId: 'test-lobby-id', users: [{ id: 'host', username: 'host', displayName: 'Host' }] });
      expect(component.statusLabel).toBe('Waiting for players...');
    });

    it('should report an error when the bot game fails to start', () => {
      spyOn(lobbyService, 'startBotGame').and.returnValue(throwError(() => new Error('fail')));
      component.ngOnInit();
      lobbyService.updateLobby({ lobbyId: 'test-lobby-id', users: [{ id: 'host', username: 'host', displayName: 'Host' }] });

      component.startBotGame();

      expect(component.botGameError).toBe('Unable to start bot game');
      expect(component.statusLabel).toBe('Unable to start bot game');
    });

    it('should periodically save the game state while started', () => {
      jasmine.clock().install();
      try {
        const saveSpy = spyOn(lobbyService, 'saveGameState').and.returnValue(of({ success: true }));
        component.ngOnInit();
        lobbyService.updateLobby(startedLobby);

        jasmine.clock().tick(30000);
        expect(saveSpy).toHaveBeenCalledWith('test-lobby-id', 'host', startedLobby.gamestate);

        component.ngOnDestroy();
        saveSpy.calls.reset();
        jasmine.clock().tick(60000);
        expect(saveSpy).not.toHaveBeenCalled();
      } finally {
        jasmine.clock().uninstall();
      }
    });
  });
  describe('cards on the table', () => {
    let lobbyService: LobbyService;

    const card = (id: string, suit: string, rank: string) => ({ id, suit, rank });
    const gamestate = {
      botGame: true,
      handNumber: 1,
      totalHands: 7,
      currentTurn: 'host',
      hands: {
        host: [card('a', 'hearts', 'A'), card('b', 'spades', 'K'), card('c', 'joker', 'JOKER')],
        'bot-1': [card('x', 'clubs', '2')]
      },
      drawPile: [card('d1', 'clubs', '5'), card('d2', 'clubs', '6')],
      discardPile: [card('older', 'hearts', '3'), card('top', 'diamonds', 'Q')]
    };
    const startedLobby = {
      lobbyId: 'test-lobby-id',
      started: true,
      users: [
        { id: 'host', username: 'host', displayName: 'Host', position: 0 },
        { id: 'bot-1', username: 'bot1', displayName: 'Bot 1', position: 1, isBot: true }
      ],
      gamestate
    };

    beforeEach(() => {
      lobbyService = TestBed.inject(LobbyService);
      spyOn(lobbyService, 'getLobby').and.returnValue(of({ lobbyId: 'test-lobby-id', users: [] }));
      component.lobbyId = 'test-lobby-id';
      // ngOnInit reads the logged-in user from localStorage
      localStorage.setItem('currentUser', JSON.stringify({
        id: 'host',
        username: 'host',
        displayName: 'Host',
        coins: 0,
        stats: { gamesWon: 0, gamesLost: 0, gamesPlayed: 0 }
      }));
      fixture.detectChanges();
    });

    afterEach(() => {
      component.ngOnDestroy();
      localStorage.removeItem('currentUser');
    });

    it('should not show any cards before the game starts', () => {
      lobbyService.updateLobby({ lobbyId: 'test-lobby-id', users: [{ id: 'host', username: 'host', displayName: 'Host' }] });
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.player-hand')).toBeNull();
      expect(el.querySelector('.table-cards')).toBeNull();
    });

    it('should only expose the current user hand', () => {
      lobbyService.updateLobby(startedLobby);

      expect(component.myHand.map(c => c.id)).toEqual(['a', 'b', 'c']);
    });

    it('should render the hand of the user playing', () => {
      lobbyService.updateLobby(startedLobby);
      fixture.detectChanges();

      const cards = fixture.nativeElement.querySelectorAll('.player-hand .hand-card');
      expect(cards.length).toBe(3);
      expect(cards[0].querySelector('.card-inner')).not.toBeNull();
    });

    it('should show the deck as face-down cards with the remaining count', () => {
      lobbyService.updateLobby(startedLobby);
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelectorAll('.draw-pile .deck-layer').length).toBe(3);
      expect(el.querySelector('.draw-pile .card-inner')).toBeNull();
      expect(el.querySelector('.draw-pile .card-back')).not.toBeNull();
      expect(el.querySelector('.draw-pile .pile-label')?.textContent).toContain('2');
    });

    it('should show the top discard card face-up on the table', () => {
      lobbyService.updateLobby(startedLobby);
      fixture.detectChanges();

      expect(component.topDiscard?.id).toBe('top');
      const el: HTMLElement = fixture.nativeElement;
      const top = fixture.debugElement.query(By.css('.discard-pile .top-card'));
      expect(top).not.toBeNull();
      const topCard = top.componentInstance as PlayingCardComponent;
      expect(topCard.rank).toBe('Q');
      expect(topCard.suit).toBe('diamonds');
      expect(topCard.faceUp).toBe(true);
      expect(el.querySelector('.discard-pile .card-inner')).not.toBeNull();
    });

    describe('taking a turn', () => {
      beforeEach(() => {
        spyOn(lobbyService, 'saveGameState').and.returnValue(of({ success: true }));
        lobbyService.updateLobby({ ...startedLobby, gamestate: { ...gamestate, turnOrder: ['host', 'bot-1'], turnPhase: 'draw' } });
        fixture.detectChanges();
      });

      const ringed = () => fixture.nativeElement.querySelectorAll('.selection-ring.selected');
      const click = (selector: string) => {
        (fixture.nativeElement.querySelector(selector) as HTMLButtonElement).click();
        fixture.detectChanges();
      };

      it('should light up the deck when the mystery card is selected', () => {
        click('.draw-pile .card-slot');

        expect(component.selectedSource).toBe('deck');
        expect(ringed().length).toBe(1);
        expect(fixture.nativeElement.querySelector('.draw-pile .card-slot.selected')).not.toBeNull();
      });

      it('should light up the face-up card when it is selected instead', () => {
        click('.draw-pile .card-slot');
        click('.discard-pile .card-slot');

        expect(component.selectedSource).toBe('discard');
        expect(ringed().length).toBe(1);
        expect(fixture.nativeElement.querySelector('.discard-pile .card-slot.selected')).not.toBeNull();
      });

      it('should not let hand cards be selected before drawing', () => {
        click('.player-hand .hand-card');

        expect(component.selectedCardIds).toEqual([]);
        expect(ringed().length).toBe(0);
      });

      it('should keep the confirm button disabled until something is selected', () => {
        const confirm = () => fixture.nativeElement.querySelector('.btn-confirm-move') as HTMLButtonElement;
        expect(confirm().disabled).toBe(true);

        click('.draw-pile .card-slot');
        expect(confirm().disabled).toBe(false);
        expect(confirm().textContent).toContain('Take mystery card');
      });

      it('should add the selected mystery card to the hand', () => {
        click('.draw-pile .card-slot');
        click('.btn-confirm-move');

        expect(component.myHand.map(c => c.id)).toEqual(['a', 'b', 'c', 'd1']);
        expect(component.drawPileCount).toBe(1);
        expect(component.selectedSource).toBeNull();
        expect(component.canDiscardNow).toBe(true);
        expect(fixture.nativeElement.querySelectorAll('.player-hand .hand-card').length).toBe(4);
      });

      it('should add the face-up card to the hand', () => {
        click('.discard-pile .card-slot');
        click('.btn-confirm-move');

        expect(component.myHand.map(c => c.id)).toEqual(['a', 'b', 'c', 'top']);
        expect(component.topDiscard?.id).toBe('older');
      });

      it('should throw the selected card face up on the stack to end the turn', () => {
        click('.draw-pile .card-slot');
        click('.btn-confirm-move');

        click('.player-hand .hand-card:nth-child(2)');
        expect(component.selectedCardIds).toEqual(['b']);
        expect(ringed().length).toBe(1);

        click('.discard-pile .card-slot');

        expect(component.topDiscard?.id).toBe('b');
        expect(component.myHand.map(c => c.id)).toEqual(['a', 'c', 'd1']);
        expect(component.gameState?.currentTurn).toBe('bot-1');
        expect(component.selectedCardIds).toEqual([]);
        expect(ringed().length).toBe(0);
      });

      it('should fly a card taken from the face-up pile into the hand without flipping it', () => {
        const animate = spyOn(HTMLElement.prototype, 'animate').and.callThrough();
        click('.discard-pile .card-slot');
        click('.btn-confirm-move');

        expect(animate).toHaveBeenCalledTimes(1);
        expect(fixture.nativeElement.querySelector('.flip-card')).toBeNull();
      });

      it('should fly and flip a mystery card taken from the deck', () => {
        const animate = spyOn(HTMLElement.prototype, 'animate').and.callThrough();
        click('.draw-pile .card-slot');
        click('.btn-confirm-move');

        expect(animate).toHaveBeenCalledTimes(2);
        expect(component.flipCardId).toBe('d1');
        const slot = fixture.nativeElement.querySelector('.hand-card[data-card-id="d1"]');
        expect(slot.querySelector('.flip-card .flip-front .card-inner')).not.toBeNull();
        expect(slot.querySelector('.flip-card .flip-back .card-back')).not.toBeNull();
      });

      it('should drop the flip markup once the animation has finished', async () => {
        click('.draw-pile .card-slot');
        click('.btn-confirm-move');
        expect(component.flipCardId).toBe('d1');

        await new Promise(resolve => setTimeout(resolve, 900));
        fixture.detectChanges();

        expect(component.flipCardId).toBeNull();
        expect(fixture.nativeElement.querySelector('.flip-card')).toBeNull();
        expect(fixture.nativeElement.querySelectorAll('.player-hand .hand-card').length).toBe(4);
      });

      it('should not allow any action while it is another player\'s turn', () => {
        lobbyService.updateGameState({ ...gamestate, turnOrder: ['host', 'bot-1'], currentTurn: 'bot-1', turnPhase: 'draw' });
        fixture.detectChanges();

        component.selectSource('deck');
        component.confirmAction();

        expect(component.selectedSource).toBeNull();
        expect(component.myHand.length).toBe(3);
        expect(component.turnHint).toContain('Waiting for');
      });
    });

    describe('rearranging the hand', () => {
      const handIds = () =>
        Array.from(fixture.nativeElement.querySelectorAll('.player-hand .hand-card')).map(
          (el) => (el as HTMLElement).dataset['cardId']
        );
      const center = (el: Element) => {
        const rect = el.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      };
      const pointer = (target: EventTarget, type: string, x: number, y: number) => {
        target.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, button: 0, pointerType: 'mouse', bubbles: true }));
        fixture.detectChanges();
      };

      beforeEach(() => {
        lobbyService.updateLobby({ ...startedLobby, gamestate: { ...gamestate, turnOrder: ['host', 'bot-1'], turnPhase: 'draw' } });
        fixture.detectChanges();
      });

      it('should move a card within the hand', () => {
        component.moveHandCard('a', 2);
        fixture.detectChanges();

        expect(component.myHand.map(c => c.id)).toEqual(['b', 'c', 'a']);
        expect(handIds()).toEqual(['b', 'c', 'a']);
      });

      it('should ignore moves to invalid positions', () => {
        component.moveHandCard('a', 5);
        component.moveHandCard('nope', 0);

        expect(component.myHand.map(c => c.id)).toEqual(['a', 'b', 'c']);
      });

      it('should reorder the hand when a card is dragged past its neighbours', () => {
        const [first, , third] = Array.from(fixture.nativeElement.querySelectorAll('.player-hand .hand-card')) as HTMLElement[];
        const start = center(first);
        const end = center(third);

        pointer(first, 'pointerdown', start.x, start.y);
        pointer(document, 'pointermove', start.x + 20, start.y);
        expect(component.dragCardId).toBe('a');
        pointer(document, 'pointermove', end.x + 5, end.y);
        pointer(document, 'pointerup', end.x + 5, end.y);

        expect(handIds()).toEqual(['b', 'c', 'a']);
        expect(component.dragCardId).toBeNull();
        expect(component.dragDx).toBe(0);
      });

      it('should not start dragging for a plain click', () => {
        const first = fixture.nativeElement.querySelector('.player-hand .hand-card') as HTMLElement;
        const start = center(first);

        pointer(first, 'pointerdown', start.x, start.y);
        pointer(document, 'pointermove', start.x + 2, start.y);
        pointer(document, 'pointerup', start.x + 2, start.y);

        expect(component.dragCardId).toBeNull();
        expect(handIds()).toEqual(['a', 'b', 'c']);
      });

      it('should not select a card at the end of a drag', () => {
        lobbyService.updateGameState({ ...gamestate, turnOrder: ['host', 'bot-1'], turnPhase: 'discard' });
        fixture.detectChanges();
        const first = fixture.nativeElement.querySelector('.player-hand .hand-card') as HTMLElement;
        const start = center(first);

        pointer(first, 'pointerdown', start.x, start.y);
        pointer(document, 'pointermove', start.x + 30, start.y);
        pointer(document, 'pointerup', start.x + 30, start.y);
        first.click();

        expect(component.selectedCardIds).toEqual([]);
      });

      it('should keep the arrangement when the state is updated and append new cards at the end', () => {
        component.moveHandCard('a', 2);
        lobbyService.updateGameState({
          ...gamestate,
          turnOrder: ['host', 'bot-1'],
          hands: { ...gamestate.hands, host: [...gamestate.hands.host, card('n', 'clubs', '9')] }
        });
        fixture.detectChanges();

        expect(component.myHand.map(c => c.id)).toEqual(['b', 'c', 'a', 'n']);
      });

      it('should allow rearranging while it is not the user\'s turn', () => {
        lobbyService.updateGameState({ ...gamestate, turnOrder: ['host', 'bot-1'], currentTurn: 'bot-1', turnPhase: 'draw' });
        fixture.detectChanges();
        component.moveHandCard('c', 0);

        expect(component.myHand.map(c => c.id)).toEqual(['c', 'a', 'b']);
      });
    });

    describe('playing on the table', () => {
      const botSet = {
        id: 'meld-bot',
        type: 'set' as const,
        rank: 'K',
        cards: [card('kh', 'hearts', 'K'), card('kd', 'diamonds', 'K'), card('kc', 'clubs', 'K')]
      };
      const playState = (overrides: Record<string, unknown> = {}) => ({
        botGame: true,
        phase: 'playing',
        handNumber: 1,
        totalHands: 7,
        currentTurn: 'host',
        turnPhase: 'discard',
        turnOrder: ['host', 'bot-1'],
        hands: {
          host: [
            card('7h', 'hearts', '7'), card('7s', 'spades', '7'), card('7d', 'diamonds', '7'),
            card('9h', 'hearts', '9'), card('9s', 'spades', '9'), card('9c', 'clubs', '9'),
            card('ks', 'spades', 'K'), card('2c', 'clubs', '2')
          ],
          'bot-1': [card('x', 'clubs', '4')]
        },
        drawPile: [card('d1', 'clubs', '5')],
        discardPile: [card('older', 'hearts', '3')],
        board: { host: [], 'bot-1': [botSet] },
        qualified: { host: false, 'bot-1': true },
        ...overrides
      });

      const el = () => fixture.nativeElement as HTMLElement;
      const press = (target: Element | null) => {
        (target as HTMLElement).click();
        fixture.detectChanges();
      };
      const pick = (...ids: string[]) => ids.forEach(id => press(el().querySelector(`.hand-card[data-card-id="${id}"]`)));
      const button = (selector: string) => el().querySelector(selector) as HTMLButtonElement;
      const stage = (type: 'set' | 'run') => press(el().querySelectorAll('.btn-stage')[type === 'set' ? 0 : 1]);
      const stageTwoSets = () => {
        pick('7h', '7s', '7d');
        stage('set');
        pick('9h', '9s', '9c');
        stage('set');
      };
      const meldsOf = (playerId: string) => el().querySelectorAll(`.space[data-player-id="${playerId}"] .meld`);

      beforeEach(() => {
        spyOn(lobbyService, 'saveGameState').and.returnValue(of({ success: true }));
        lobbyService.updateLobby({ ...startedLobby, gamestate: playState() as never });
        fixture.detectChanges();
      });

      it('should give the table one space per player', () => {
        expect(el().querySelectorAll('app-board .space').length).toBe(2);
        expect(meldsOf('bot-1').length).toBe(1);
        expect(meldsOf('host').length).toBe(0);
      });

      it('should say what the player must lay down to qualify', () => {
        expect(el().querySelector('.requirement')?.textContent).toContain('Hand 1: lay down two sets to qualify');
      });

      it('should only offer to stage a set or a run once enough cards are selected', () => {
        expect(button('.btn-stage').disabled).toBe(true);

        pick('7h', '7s', '7d');
        expect(component.canStageSet).toBe(true);
        expect(component.canStageRun).toBe(false);

        pick('9h');
        expect(component.canStageRun).toBe(true);
      });

      it('should stage sets and lay them down together to qualify', () => {
        stageTwoSets();

        expect(component.stagedMelds.length).toBe(2);
        expect(el().querySelectorAll('.staged-meld').length).toBe(2);
        expect(component.selectedCardIds).toEqual([]);

        press(el().querySelector('.btn-lay-down'));

        expect(meldsOf('host').length).toBe(2);
        expect(component.iAmQualified).toBe(true);
        expect(component.myHand.map(c => c.id)).toEqual(['ks', '2c']);
        expect(component.stagedMelds).toEqual([]);
        expect(el().querySelector('.space[data-player-id="host"] .badge')).not.toBeNull();
        expect(el().querySelector('.requirement')).toBeNull();
        expect(component.gameState?.turnPhase).toBe('discard');
      });

      it('should explain why cards cannot be staged as a set', () => {
        pick('7h', '7s', '9h');
        stage('set');

        expect(el().querySelector('.action-error')?.textContent).toContain('same rank');
        expect(component.stagedMelds.length).toBe(0);
      });

      it('should explain when the staged melds do not qualify yet', () => {
        pick('7h', '7s', '7d');
        stage('set');
        press(el().querySelector('.btn-lay-down'));

        expect(el().querySelector('.action-error')?.textContent).toContain('Hand 1 needs two sets to qualify');
        expect(meldsOf('host').length).toBe(0);
      });

      it('should let a staged meld be taken back', () => {
        pick('7h', '7s', '7d');
        stage('set');
        press(el().querySelector('.btn-unstage'));

        expect(component.stagedMelds).toEqual([]);
        expect(el().querySelector('.hand-card[data-card-id="7h"].staged')).toBeNull();
      });

      it('should not select staged cards again', () => {
        pick('7h', '7s', '7d');
        stage('set');
        pick('7h');

        expect(component.selectedCardIds).toEqual([]);
      });

      it('should not let melds be targeted before qualifying', () => {
        pick('ks');
        expect(component.canAddToMeld).toBe(false);

        press(el().querySelector('.space[data-player-id="bot-1"] .meld'));
        expect(component.myHand.length).toBe(8);
      });

      it('should add selected cards to a set another player played once qualified', () => {
        stageTwoSets();
        press(el().querySelector('.btn-lay-down'));
        pick('ks');
        expect(component.canAddToMeld).toBe(true);

        press(el().querySelector('.space[data-player-id="bot-1"] .meld'));

        expect(el().querySelectorAll('.space[data-player-id="bot-1"] .meld app-playing-card').length).toBe(4);
        expect(component.myHand.map(c => c.id)).toEqual(['2c']);
        expect(component.selectedCardIds).toEqual([]);
      });

      it('should show why a card cannot be added to a meld', () => {
        stageTwoSets();
        press(el().querySelector('.btn-lay-down'));
        pick('2c');
        press(el().querySelector('.space[data-player-id="bot-1"] .meld'));

        expect(el().querySelector('.action-error')?.textContent).toContain('match');
        expect(component.myHand.length).toBe(2);
      });

      it('should only throw away one card at a time', () => {
        pick('ks', '2c');
        expect(component.canThrow).toBe(false);
        expect(button('.btn-confirm-move').disabled).toBe(true);

        pick('2c');
        expect(component.canThrow).toBe(true);
      });

      it('should clear staged melds when the turn passes', () => {
        pick('7h', '7s', '7d');
        stage('set');
        pick('ks');
        press(el().querySelector('.btn-confirm-move'));

        expect(component.stagedMelds).toEqual([]);
        expect(component.gameState?.currentTurn).toBe('bot-1');
        expect(el().querySelector('.hand-actions')).toBeNull();
      });

      it('should announce the end of the hand when someone plays all their cards', () => {
        lobbyService.updateGameState(playState({ phase: 'handOver', winnerId: 'bot-1', turnPhase: 'over', currentTurn: 'bot-1' }) as never);
        fixture.detectChanges();

        expect(component.turnHint).toContain('Bot 1 played all their cards');
        expect(component.statusLabel).toBe('Hand 1 of 7 is over');
        expect(el().querySelector('.hand-actions')).toBeNull();
        expect(el().querySelector('.btn-confirm-move')).toBeNull();
      });

      it('should have the bot take its turn after the user, without freezing when the hand is over', () => {
        jasmine.clock().install();
        try {
          lobbyService.updateGameState(playState({ phase: 'handOver', winnerId: 'bot-1', turnPhase: 'over', currentTurn: 'bot-1' }) as never);
          fixture.detectChanges();
          jasmine.clock().tick(5000);

          expect(component.gameState?.phase).toBe('handOver');
        } finally {
          jasmine.clock().uninstall();
        }
      });
    });

    describe('bot turns', () => {
      beforeEach(() => {
        jasmine.clock().install();
        spyOn(lobbyService, 'saveGameState').and.returnValue(of({ success: true }));
      });

      afterEach(() => {
        jasmine.clock().uninstall();
      });

      it('should let the bot draw and throw away a card after the user ends their turn', () => {
        lobbyService.updateLobby({
          ...startedLobby,
          gamestate: { ...gamestate, turnOrder: ['host', 'bot-1'], currentTurn: 'bot-1', turnPhase: 'draw' }
        });
        fixture.detectChanges();
        expect(component.gameState?.currentTurn).toBe('bot-1');

        jasmine.clock().tick(1000);
        expect(component.gameState?.turnPhase).toBe('discard');
        expect(component.gameState?.hands?.['bot-1'].length).toBe(2);

        jasmine.clock().tick(1000);
        expect(component.gameState?.currentTurn).toBe('host');
        expect(component.gameState?.turnPhase).toBe('draw');
        expect(component.gameState?.hands?.['bot-1'].length).toBe(1);
        expect(component.canDrawNow).toBe(true);
      });
    });

    it('should show an empty slot when the discard pile is empty', () => {
      lobbyService.updateLobby({ ...startedLobby, gamestate: { ...gamestate, discardPile: [] } });
      fixture.detectChanges();

      expect(component.topDiscard).toBeNull();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.discard-pile .top-card')).toBeNull();
      expect(el.querySelector('.discard-pile .empty-pile')).not.toBeNull();
    });
  });
});

import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { GameSyncService } from './game-sync.service';
import { GameState, LobbyService } from './lobby.service';
import { DataChannelMessage, WebRTCService } from './webrtc.service';

const card = (id: string) => ({ id, suit: 'hearts', rank: '5' });

function dealt(): GameState {
  return {
    phase: 'playing',
    botGame: false,
    handNumber: 1,
    totalHands: 7,
    turnOrder: ['host', 'ann'],
    currentTurn: 'host',
    turnPhase: 'draw',
    hands: { host: [card('h1')], ann: [card('a1')] },
    drawPile: [card('d1'), card('d2')],
    discardPile: [card('x1')],
    scores: { host: 0, ann: 0 }
  } as GameState;
}

describe('GameSyncService', () => {
  let sync: GameSyncService;
  let lobby: LobbyService;
  let messages: Subject<DataChannelMessage>;
  let connected: Subject<string>;
  let webrtc: { dataChannelMessage$: Subject<DataChannelMessage>; peerConnected$: Subject<string>; sendToPeer: jasmine.Spy; broadcast: jasmine.Spy };

  beforeEach(() => {
    messages = new Subject();
    connected = new Subject();
    webrtc = {
      dataChannelMessage$: messages,
      peerConnected$: connected,
      sendToPeer: jasmine.createSpy('sendToPeer').and.returnValue(true),
      broadcast: jasmine.createSpy('broadcast')
    };
    TestBed.configureTestingModule({ providers: [{ provide: WebRTCService, useValue: webrtc }] });
    sync = TestBed.inject(GameSyncService);
    lobby = TestBed.inject(LobbyService);
  });

  afterEach(() => sync.stop());

  describe('as host', () => {
    beforeEach(() => {
      lobby.updateGameState(dealt());
      sync.start('host', 'host');
    });

    it('should reject a guest move played out of turn and tell that guest', () => {
      messages.next({ type: 'move', from: 'ann', data: { type: 'draw', source: 'deck' } });
      expect(webrtc.sendToPeer).toHaveBeenCalledWith('ann', 'moveRejected', jasmine.anything());
      expect(webrtc.broadcast).not.toHaveBeenCalled();
    });

    it('should apply its own move and broadcast it', () => {
      sync.submit({ type: 'draw', source: 'deck' });
      expect(webrtc.broadcast).toHaveBeenCalledWith('gameState', jasmine.objectContaining({ turnPhase: 'discard' }));
    });

    it('should ignore malformed moves silently', () => {
      messages.next({ type: 'move', from: 'ann', data: { type: 'nonsense' } });
      expect(webrtc.broadcast).not.toHaveBeenCalled();
      expect(webrtc.sendToPeer).not.toHaveBeenCalled();
    });

    it('should send the current state to a peer that connects', () => {
      connected.next('ann');
      expect(webrtc.sendToPeer).toHaveBeenCalledWith('ann', 'gameState', jasmine.objectContaining({ phase: 'playing' }));
    });

    it('should ignore game states sent by guests', () => {
      messages.next({ type: 'gameState', from: 'ann', data: { ...dealt(), handNumber: 5 } });
      let latest: GameState | null = null;
      lobby.getGameState().subscribe(s => (latest = s));
      expect(latest!.handNumber).toBe(1);
    });
  });

  describe('as guest', () => {
    beforeEach(() => {
      lobby.updateGameState(dealt());
      sync.start('ann', 'host');
    });

    it('should send moves to the host instead of applying them', () => {
      sync.submit({ type: 'draw', source: 'deck' });
      expect(webrtc.sendToPeer).toHaveBeenCalledWith('host', 'move', { type: 'draw', source: 'deck' });
      expect(webrtc.broadcast).not.toHaveBeenCalled();
    });

    it('should fail when the host is unreachable', () => {
      webrtc.sendToPeer.and.returnValue(false);
      expect(() => sync.submit({ type: 'draw', source: 'deck' })).toThrowError('Not connected to the host');
    });

    it('should accept state from the host only', () => {
      let latest: GameState | null = null;
      lobby.getGameState().subscribe(s => (latest = s));
      messages.next({ type: 'gameState', from: 'bo', data: { ...dealt(), handNumber: 3 } });
      expect(latest!.handNumber).toBe(1);
      messages.next({ type: 'gameState', from: 'host', data: { ...dealt(), handNumber: 2 } });
      expect(latest!.handNumber).toBe(2);
    });

    it('should not act on moves sent by other guests', () => {
      messages.next({ type: 'move', from: 'bo', data: { type: 'draw', source: 'deck' } });
      expect(webrtc.broadcast).not.toHaveBeenCalled();
    });

    it('should refuse to deal the next hand', () => {
      expect(() => sync.dealNextHand()).toThrowError('Only the host can deal the next hand');
    });
  });
});

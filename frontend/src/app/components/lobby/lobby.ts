import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { User } from '../../services/user.service';
import { HeaderComponent } from '../header/header.component';
import { LobbyService, GameState, Card } from '../../services/lobby.service';
import { PlayingCardComponent, Suit, Rank } from '../playing-card/playing-card.component';
import {
  DrawSource,
  MeldGroup,
  addToMeld,
  canDiscard,
  canDraw,
  discardCard,
  drawCard,
  isHandOver,
  playBotStep,
  playMelds
} from '../../services/game-logic';
import { buildRun, buildSet, describeRequirement, requirementFor } from '../../services/melds';
import { BoardComponent, BoardSpace, MeldTarget } from '../board/board.component';
import { WebRTCService } from '../../services/webrtc.service';
import { SignalingService } from '../../services/signaling.service';
import { Subscription, firstValueFrom, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

interface Player {
  id: string;
  username: string;
  displayName: string;
  position: number;
  isBot?: boolean;
}

const AUTOSAVE_INTERVAL_MS = 30000;
const BOT_MOVE_DELAY_MS = 900;
const DRAG_THRESHOLD_PX = 6;
const DRAW_ANIMATION_MS = 650;

@Component({
  selector: 'app-lobby',
  standalone: true,
  // State is held in plain fields and changed from subscriptions and timers, so the view must be checked eagerly
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [CommonModule, HeaderComponent, PlayingCardComponent, BoardComponent],
  templateUrl: './lobby.html',
  styleUrls: ['./lobby.css']
})
export class Lobby implements OnInit, OnDestroy {
  userCoins = 0;
  lobbyId: string | null = null;
  players: Player[] = [];
  maxPlayers = 6;
  isHost = false;
  currentUserId: string | null = null;
  currentUser: User | null = null;
  
  showProfileModal = false;
  showRulesModal = false;

  isStarted = false;
  gameState: GameState | null = null;
  botGameError: string | null = null;

  // What the user has picked but not yet confirmed
  selectedSource: DrawSource | null = null;
  selectedCardIds: string[] = [];
  // Sets and runs picked out of the hand that will be laid on the table together
  stagedMelds: MeldGroup[] = [];
  actionError: string | null = null;
  boardSpaces: BoardSpace[] = [];

  private subscriptions: Subscription[] = [];
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  // The user's own arrangement of the hand (card ids), kept locally so peers' updates can't undo it
  private handOrder: string[] = [];
  private hand: Card[] = [];

  // Hand drag state
  dragCardId: string | null = null;
  dragDx = 0;
  private drag: { id: string; startX: number; startY: number; grabOffset: number; moved: boolean } | null = null;
  private justDragged = false;

  // The card that was just taken from the deck and is still flipping over
  flipCardId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private lobbyService: LobbyService,
    private webrtcService: WebRTCService,
    private signalingService: SignalingService,
    private host: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.lobbyId = this.route.snapshot.paramMap.get('id');
    this.loadCurrentUser();
    this.setupEventListeners();
    this.loadLobby();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    // Cleanup P2P connections
    this.cleanup();
  }

  get humanCount(): number {
    return this.players.filter(p => !p.isBot).length;
  }

  get isBotGame(): boolean {
    return this.isStarted && !!this.gameState?.botGame;
  }

  // The hand dealt to the user playing on this device
  get myHand(): Card[] {
    return this.hand;
  }

  // Rebuilds the displayed hand: the user's own ordering first, newly received cards at the end
  private refreshHand(): void {
    const raw = this.currentUserId ? this.gameState?.hands?.[this.currentUserId] ?? [] : [];
    const position = new Map(this.handOrder.map((id, index) => [id, index]));
    this.hand = raw
      .map((card, index) => ({ card, key: position.get(card.id) ?? this.handOrder.length + index }))
      .sort((a, b) => a.key - b.key)
      .map(entry => entry.card);
    this.handOrder = this.hand.map(c => c.id);
  }

  moveHandCard(cardId: string, toIndex: number): void {
    const from = this.hand.findIndex(c => c.id === cardId);
    if (from < 0 || toIndex < 0 || toIndex >= this.hand.length || from === toIndex) {
      return;
    }
    const next = [...this.hand];
    const [card] = next.splice(from, 1);
    next.splice(toIndex, 0, card);
    this.hand = next;
    this.handOrder = next.map(c => c.id);
  }

  onHandPointerDown(event: PointerEvent, card: Card): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.drag = {
      id: card.id,
      startX: event.clientX,
      startY: event.clientY,
      grabOffset: event.clientX - (rect.left + rect.width / 2),
      moved: false
    };
  }

  @HostListener('document:pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag) {
      return;
    }
    if (!drag.moved) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD_PX) {
        return;
      }
      drag.moved = true;
      this.dragCardId = drag.id;
    }

    const pointerCenter = event.clientX - drag.grabOffset;
    const slots = this.handSlots();
    const index = this.hand.findIndex(c => c.id === drag.id);
    const target = slots.filter((el, i) => {
      if (i === index) {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return rect.left + rect.width / 2 < pointerCenter;
    }).length;

    if (target !== index) {
      this.moveHandCard(drag.id, target);
      // Re-render so the dragged card is measured at its new slot before it follows the pointer again
      this.cdr.detectChanges();
    }
    this.dragDx = this.dragOffsetFor(pointerCenter);
  }

  @HostListener('document:pointerup')
  @HostListener('document:pointercancel')
  onPointerUp(): void {
    if (this.drag?.moved) {
      // The click that follows a drag must not select the card
      this.justDragged = true;
      setTimeout(() => (this.justDragged = false));
    }
    this.drag = null;
    this.dragCardId = null;
    this.dragDx = 0;
  }

  private handSlots(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.player-hand .hand-card'));
  }

  // Distance between where the dragged card sits in the layout and where the pointer wants it
  private dragOffsetFor(pointerCenter: number): number {
    const index = this.hand.findIndex(c => c.id === this.dragCardId);
    const el = this.handSlots()[index];
    if (!el) {
      return 0;
    }
    const rect = el.getBoundingClientRect();
    const layoutCenter = rect.left + rect.width / 2 - this.dragDx;
    return pointerCenter - layoutCenter;
  }

  get drawPileCount(): number {
    return this.gameState?.drawPile?.length ?? 0;
  }

  get topDiscard(): Card | null {
    const pile = this.gameState?.discardPile;
    return pile && pile.length > 0 ? pile[pile.length - 1] : null;
  }

  get showTableCards(): boolean {
    return this.isStarted && !!this.gameState;
  }

  suitOf(card: Card): Suit {
    return card.suit as Suit;
  }

  rankOf(card: Card): Rank {
    return card.rank as Rank;
  }

  trackCard(_index: number, card: Card): string {
    return card.id;
  }

  get isMyTurn(): boolean {
    return !!this.gameState && this.gameState.currentTurn === this.currentUserId;
  }

  get canDrawNow(): boolean {
    return canDraw(this.gameState, this.currentUserId);
  }

  get canDiscardNow(): boolean {
    return canDiscard(this.gameState, this.currentUserId);
  }

  get isHandOver(): boolean {
    return isHandOver(this.gameState);
  }

  get iAmQualified(): boolean {
    return !!this.currentUserId && !!this.gameState?.qualified?.[this.currentUserId];
  }

  get canThrow(): boolean {
    return this.canDiscardNow && this.selectedCardIds.length === 1;
  }

  get canStageSet(): boolean {
    return this.canDiscardNow && this.selectedCardIds.length >= 3;
  }

  get canStageRun(): boolean {
    return this.canDiscardNow && this.selectedCardIds.length >= 4;
  }

  get canLayDown(): boolean {
    return this.canDiscardNow && this.stagedMelds.length > 0;
  }

  // Selected cards can be added to any meld on the table once the player has qualified
  get canAddToMeld(): boolean {
    return this.canDiscardNow && this.iAmQualified && this.selectedCardIds.length > 0;
  }

  get requirementLabel(): string {
    if (!this.showTableCards || this.isHandOver || this.iAmQualified) {
      return '';
    }
    const handNumber = this.gameState?.handNumber ?? 1;
    return `Hand ${handNumber}: lay down ${describeRequirement(requirementFor(handNumber))} to qualify`;
  }

  get canConfirm(): boolean {
    return this.canDrawNow ? this.selectedSource !== null : this.canThrow;
  }

  get confirmLabel(): string {
    if (this.canDiscardNow) {
      return 'Throw away card';
    }
    if (this.selectedSource === 'deck') {
      return 'Take mystery card';
    }
    return this.selectedSource === 'discard' ? 'Take face-up card' : 'Take card';
  }

  get turnHint(): string {
    if (!this.showTableCards) {
      return '';
    }
    if (this.isHandOver) {
      const winner = this.players.find(p => p.id === this.gameState?.winnerId)?.displayName;
      return winner ? `${winner} played all their cards. The hand is over.` : 'The hand is over.';
    }
    if (this.canDrawNow) {
      return 'Your turn: pick the mystery card from the deck or the face-up card';
    }
    if (this.canDiscardNow) {
      return 'Play sets and runs on the table, then select a card to throw away';
    }
    const name = this.currentTurnName;
    return name ? `Waiting for ${name}...` : '';
  }

  selectSource(source: DrawSource): void {
    if (!this.canDrawNow) {
      return;
    }
    this.selectedSource = this.selectedSource === source ? null : source;
  }

  isSelected(card: Card): boolean {
    return this.selectedCardIds.includes(card.id);
  }

  isStaged(card: Card): boolean {
    return this.stagedMelds.some(group => group.cardIds.includes(card.id));
  }

  selectHandCard(card: Card): void {
    if (this.justDragged || !this.canDiscardNow || this.isStaged(card)) {
      return;
    }
    this.actionError = null;
    this.selectedCardIds = this.isSelected(card)
      ? this.selectedCardIds.filter(id => id !== card.id)
      : [...this.selectedCardIds, card.id];
  }

  cardText(cardId: string): string {
    const card = this.myHand.find(c => c.id === cardId);
    if (!card) {
      return '';
    }
    const symbols: Record<string, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
    return card.rank === 'JOKER' ? 'Joker' : `${card.rank}${symbols[card.suit] ?? ''}`;
  }

  stageMeld(type: 'set' | 'run'): void {
    const cards = this.myHand.filter(c => this.isSelected(c));
    const result = type === 'set' ? buildSet(cards) : buildRun(cards);
    if ('error' in result) {
      this.actionError = result.error;
      return;
    }
    this.stagedMelds = [...this.stagedMelds, { type, cardIds: cards.map(c => c.id) }];
    this.selectedCardIds = [];
    this.actionError = null;
  }

  unstageMeld(index: number): void {
    this.stagedMelds = this.stagedMelds.filter((_, i) => i !== index);
    this.actionError = null;
  }

  layDown(): void {
    if (!this.gameState || !this.currentUserId || !this.canLayDown) {
      return;
    }
    try {
      this.applyGameState(playMelds(this.gameState, this.currentUserId, this.stagedMelds));
      this.stagedMelds = [];
      this.selectedCardIds = [];
      this.actionError = null;
    } catch (error) {
      this.actionError = error instanceof Error ? error.message : 'Unable to play those cards';
    }
  }

  addSelectedTo(target: MeldTarget): void {
    if (!this.gameState || !this.currentUserId || !this.canAddToMeld) {
      return;
    }
    try {
      this.applyGameState(
        addToMeld(this.gameState, this.currentUserId, target.ownerId, target.meldId, this.selectedCardIds)
      );
      this.selectedCardIds = [];
      this.actionError = null;
    } catch (error) {
      this.actionError = error instanceof Error ? error.message : 'Unable to add those cards';
    }
  }

  // While discarding, tapping the face-up pile throws the selected card onto it
  onDiscardPileClick(): void {
    if (this.canDrawNow) {
      this.selectSource('discard');
    } else {
      this.confirmAction();
    }
  }

  confirmAction(): void {
    if (!this.gameState || !this.currentUserId || !this.canConfirm) {
      return;
    }
    try {
      if (this.canDrawNow && this.selectedSource) {
        const source = this.selectedSource;
        const from = this.pileElement(source)?.getBoundingClientRect() ?? null;
        const previous = this.myHand.length;
        this.applyGameState(drawCard(this.gameState, this.currentUserId, source));
        const added = this.myHand[this.myHand.length - 1];
        if (added && this.myHand.length > previous) {
          this.animateNewCard(added.id, source, from);
        }
      } else if (this.canThrow) {
        this.applyGameState(discardCard(this.gameState, this.currentUserId, this.selectedCardIds[0]));
        this.saveGameState();
      }
    } catch (error) {
      console.error('Invalid move:', error);
    }
  }

  private pileElement(source: DrawSource): HTMLElement | null {
    return this.host.nativeElement.querySelector(`.${source === 'deck' ? 'draw' : 'discard'}-pile .card-slot`);
  }

  // The new card flies from the pile it came from into the hand; mystery cards flip over on the way
  private animateNewCard(cardId: string, source: DrawSource, from: DOMRect | null): void {
    if (!from || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    if (source === 'deck') {
      this.flipCardId = cardId;
    }
    this.cdr.detectChanges();

    const el = this.handSlots().find(slot => slot.dataset['cardId'] === cardId);
    if (!el || typeof el.animate !== 'function') {
      this.flipCardId = null;
      return;
    }
    const to = el.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const timing = { duration: DRAW_ANIMATION_MS, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' };

    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)`, zIndex: 20 },
        { transform: 'translate(0, 0)', zIndex: 20 }
      ],
      timing
    );

    const flip = el.querySelector<HTMLElement>('.flip-card');
    if (flip && source === 'deck') {
      flip
        .animate(
          [
            { transform: 'perspective(800px) rotateY(180deg)' },
            { transform: 'perspective(800px) rotateY(180deg)', offset: 0.3 },
            { transform: 'perspective(800px) rotateY(0deg)' }
          ],
          { ...timing, easing: 'ease-in-out' }
        )
        .finished.then(() => this.endFlip(cardId))
        .catch(() => this.endFlip(cardId));
    }
  }

  private endFlip(cardId: string): void {
    if (this.flipCardId === cardId) {
      this.flipCardId = null;
      if (!this.destroyed) {
        this.cdr.detectChanges();
      }
    }
  }

  private applyGameState(next: GameState): void {
    this.lobbyService.updateGameState(next);
    // Bot games stay on this device; with other humans the move is shared with peers
    if (!next.botGame) {
      this.webrtcService.broadcast('gameState', next);
    }
  }

  private syncSelection(): void {
    if (!this.canDrawNow) {
      this.selectedSource = null;
    }
    if (!this.canDiscardNow) {
      this.selectedCardIds = [];
      this.stagedMelds = [];
      this.actionError = null;
      return;
    }
    const inHand = (id: string) => this.myHand.some(c => c.id === id);
    this.selectedCardIds = this.selectedCardIds.filter(inHand);
    this.stagedMelds = this.stagedMelds.filter(group => group.cardIds.every(inHand));
  }

  private refreshBoard(): void {
    const state = this.gameState;
    const order = state?.turnOrder ?? this.players.map(p => p.id);
    this.boardSpaces = !state
      ? []
      : order.map(id => {
          const player = this.players.find(p => p.id === id);
          return {
            playerId: id,
            name: player?.displayName ?? 'Player',
            isMe: id === this.currentUserId,
            isBot: !!player?.isBot,
            qualified: !!state.qualified?.[id],
            melds: state.board?.[id] ?? []
          };
        });
  }

  private scheduleBotMove(): void {
    this.clearBotTimer();
    const state = this.gameState;
    const bot = state?.botGame ? this.players.find(p => p.isBot && p.id === state.currentTurn) : null;
    if (!state || !bot || !(canDraw(state, bot.id) || canDiscard(state, bot.id))) {
      return;
    }
    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      if (this.gameState !== state) {
        return;
      }
      try {
        this.applyGameState(playBotStep(state, bot.id));
      } catch (error) {
        console.error('Bot move failed:', error);
      }
    }, BOT_MOVE_DELAY_MS);
  }

  private clearBotTimer(): void {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
  }

  get canStartBotGame(): boolean {
    return !this.isStarted && this.humanCount <= 1;
  }

  get currentTurnName(): string {
    const turnId = this.gameState?.currentTurn;
    return this.players.find(p => p.id === turnId)?.displayName ?? '';
  }

  get handLabel(): string {
    return `Hand ${this.gameState?.handNumber ?? 1} of ${this.gameState?.totalHands ?? 7}`;
  }

  get statusLabel(): string {
    if (this.botGameError) {
      return this.botGameError;
    }
    if (this.isStarted && this.isHandOver) {
      return `Hand ${this.gameState?.handNumber ?? 1} of ${this.gameState?.totalHands ?? 7} is over`;
    }
    if (this.isStarted) {
      const turn = this.currentTurnName;
      return turn ? `${this.handLabel} - ${turn}'s turn` : this.handLabel;
    }
    if (this.players.length < 2) {
      return 'Waiting for players...';
    }
    return this.isHost ? '' : 'Waiting for host to start';
  }

  private setupEventListeners(): void {
    // Listen for peer joined events
    const peerJoinedSub = this.signalingService.peerJoined$.subscribe((peerId) => {
      console.log('Peer joined:', peerId);
      // Peer will be added through lobby service updates
    });

    // Listen for peer left events
    const peerLeftSub = this.signalingService.peerLeft$.subscribe((peerId) => {
      console.log('Peer left:', peerId);
      this.lobbyService.removePlayerFromLobby(peerId);
    });

    // Listen for data channel messages
    const dataChannelSub = this.webrtcService.dataChannelMessage$.subscribe((message) => {
      this.handleP2PMessage(message);
    });

    // Listen for lobby updates
    const lobbySub = this.lobbyService.getCurrentLobby().subscribe((lobby) => {
      if (lobby) {
        this.players = lobby.users.map((user, index) => ({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          position: user.position ?? index,
          isBot: user.isBot
        }));
        this.isHost = this.currentUserId === this.players[0]?.id;
        this.isStarted = !!lobby.started;
        this.refreshBoard();
        if (this.isStarted) {
          this.botGameError = null;
          this.startAutoSave();
        } else {
          this.stopAutoSave();
        }
      }
    });

    // Listen for game state updates
    const gameStateSub = this.lobbyService.getGameState().subscribe((state) => {
      this.gameState = state;
      this.refreshHand();
      this.refreshBoard();
      this.syncSelection();
      this.scheduleBotMove();
    });

    this.subscriptions.push(peerJoinedSub, peerLeftSub, dataChannelSub, lobbySub, gameStateSub);
  }

  private async setupP2PConnections(): Promise<void> {
    if (!this.lobbyId || !this.currentUserId) {
      return;
    }

    try {
      // Initialize signaling for this lobby
      await this.signalingService.initializeForLobby(this.lobbyId, this.currentUserId);
      
      // Notify other users that we joined
      await firstValueFrom(this.signalingService.notifyJoined(this.lobbyId, this.currentUserId));
    } catch (error) {
      console.error('Error setting up P2P connections:', error);
    }
  }

  private handleP2PMessage(message: any): void {
    console.log('Received P2P message:', message);
    
    // Handle different message types
    switch (message.type) {
      case 'gameState':
        // Update game state from peer
        if (message.data) {
          this.lobbyService.updateGameState(message.data);
        }
        break;
      case 'playerAction':
        // Handle player action
        console.log('Player action:', message.data);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private startAutoSave(): void {
    if (this.autoSaveTimer) {
      return;
    }
    this.autoSaveTimer = setInterval(() => this.saveGameState(), AUTOSAVE_INTERVAL_MS);
  }

  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  private saveGameState(): void {
    if (!this.lobbyId || !this.currentUserId || !this.isStarted || !this.gameState) {
      return;
    }
    this.lobbyService.saveGameState(this.lobbyId, this.currentUserId, this.gameState).subscribe({
      error: (error) => console.error('Error saving game state:', error)
    });
  }

  private closeP2PConnections(): void {
    this.signalingService.cleanup();
    this.webrtcService.closeAllConnections();
  }

  private cleanup(): void {
    // Persist the latest game state before tearing everything down
    this.saveGameState();
    this.stopAutoSave();
    this.clearBotTimer();

    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    
    // Notify others we're leaving
    if (this.lobbyId && this.currentUserId) {
      this.signalingService.notifyLeft(this.lobbyId, this.currentUserId).subscribe({
        error: (error) => console.error('Error notifying peers of leaving:', error)
      });
    }
    
    // Clean up signaling and close all WebRTC connections
    this.closeP2PConnections();
  }

  loadCurrentUser(): void {
    const userJson = localStorage.getItem('currentUser');
    if (userJson) {
      this.currentUser = JSON.parse(userJson);
      this.currentUserId = this.currentUser!.id;
      this.userCoins = this.currentUser?.coins ?? 0;
    }
  }

  loadLobby(): void {
    if (!this.lobbyId) {
      return;
    }

    // Load lobby data from API
    this.lobbyService.getLobby(this.lobbyId).subscribe({
      next: (lobby) => {
        // Bot games are local to the client, so they don't need peer connections
        if (!lobby.gamestate?.botGame) {
          this.setupP2PConnections();
        }
      },
      error: (error) => {
        console.error('Error loading lobby:', error);
      }
    });
  }

  getPlayerAtPosition(position: number): Player | null {
    return this.players.find(p => p.position === position) || null;
  }

  isPositionOccupied(position: number): boolean {
    return this.players.some(p => p.position === position);
  }

  getEmptySeats(): number[] {
    const occupied = new Set(this.players.map(p => p.position));
    return Array.from({ length: this.maxPlayers }, (_, i) => i)
      .filter(i => !occupied.has(i));
  }

  leaveLobby(): void {
    if (this.lobbyId && this.currentUserId) {
      this.lobbyService.leaveLobby(this.lobbyId, this.currentUserId).subscribe({
        next: () => {
          this.cleanup();
          this.router.navigate(['/']);
        },
        error: (error) => {
          console.error('Error leaving lobby:', error);
        }
      });
    }
  }

  startGame(): void {
    if (this.isHost && this.players.length >= 2) {
      console.log('Starting game...');
      
      // Broadcast game start to all peers via P2P
      this.webrtcService.broadcast('gameStart', {
        players: this.players,
        timestamp: Date.now()
      });
      
      // Navigate to game or update state
      // TODO: Implement game start logic
    }
  }

  copyLobbyLink(): void {
    const link = `${globalThis.location.origin}/lobby/${this.lobbyId}`;
    navigator.clipboard.writeText(link).then(() => {
      console.log('Lobby link copied!');
    }).catch((error) => {
      console.error('Failed to copy lobby link:', error);
    });

  }

  startBotGame(): void {
    if (!this.canStartBotGame || !this.currentUserId) {
      return;
    }
    const userId = this.currentUserId;
    this.botGameError = null;

    // Without a lobby that this user hosts (e.g. the placeholder "main" route), create one first
    const lobby$ = this.isHost && this.lobbyId
      ? of(this.lobbyId)
      : this.lobbyService.createLobby(userId).pipe(map(lobby => lobby.lobbyId));

    lobby$.pipe(
      switchMap(lobbyId => this.lobbyService.startBotGame(lobbyId, userId))
    ).subscribe({
      next: (lobby) => {
        if (lobby.lobbyId !== this.lobbyId) {
          this.lobbyId = lobby.lobbyId;
          this.router.navigate(['/lobby', lobby.lobbyId], { replaceUrl: true });
        }
        this.closeP2PConnections();
      },
      error: (error) => {
        console.error('Error starting bot game:', error);
        this.botGameError = 'Unable to start bot game';
      }
    });
  }
}

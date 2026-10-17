import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, Subscription, TimeoutError, exhaustMap, firstValueFrom, timeout, timer } from 'rxjs';
import { LocalIceCandidate, PeerStatusChange, WebRTCService } from './webrtc.service';

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'peer-joined' | 'peer-left';
  from: string;
  to: string;
  // Names the connection attempt that an offer, answer or batch of candidates belongs to
  connectionId?: string;
  payload?: unknown;
}

export const SIGNALING_POLL_INTERVAL_MS = 1000;
// A request that never answers must not stall polling, or the messages queued behind it
export const REQUEST_TIMEOUT_MS = 10000;
// Candidates trickle in over a second or so; sending them in batches keeps the request count low
export const CANDIDATE_BATCH_MS = 150;
// Waits before re-sending a message that failed for a reason that may pass (network, 429, 5xx)
export const SEND_RETRY_DELAYS_MS = [500, 1500, 4000];
// Waits before the side that started a connection tries again after it failed
export const CONNECT_RETRY_DELAYS_MS = [1000, 3000, 6000];

const MAX_CANDIDATES_PER_MESSAGE = 50;
const MAX_CANDIDATE_LENGTH = 1024;
const MAX_SDP_LENGTH = 16384;
const MAX_ID_LENGTH = 64;
const MAX_TRACKED_ATTEMPTS = 3;

interface Session {
  lobbyId: string;
  userId: string;
}

interface CandidateBatch {
  candidates: RTCIceCandidateInit[];
  timer: ReturnType<typeof setTimeout> | null;
  // Candidates are only sent after the offer or answer they belong to has been queued
  descriptionQueued: boolean;
}

interface Outbox {
  // Messages to one peer go out one at a time, so an offer always precedes its candidates
  tail: Promise<void>;
  batches: Map<string, CandidateBatch>;
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

function parseDescription(value: unknown, type: 'offer' | 'answer'): RTCSessionDescriptionInit | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const { type: actual, sdp } = value as Record<string, unknown>;
  if (actual !== type || typeof sdp !== 'string' || sdp.length === 0 || sdp.length > MAX_SDP_LENGTH) {
    return null;
  }
  return { type, sdp };
}

function parseCandidate(value: unknown): RTCIceCandidateInit | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const { candidate, sdpMid, sdpMLineIndex, usernameFragment } = value as Record<string, unknown>;
  if (typeof candidate !== 'string' || candidate.length > MAX_CANDIDATE_LENGTH) {
    return null;
  }
  return {
    candidate,
    sdpMid: typeof sdpMid === 'string' ? sdpMid : null,
    sdpMLineIndex: typeof sdpMLineIndex === 'number' ? sdpMLineIndex : null,
    ...(typeof usernameFragment === 'string' ? { usernameFragment } : {})
  };
}

// Network trouble, rate limiting and server hiccups are worth another try; other rejections are not
function isTransient(error: unknown): boolean {
  if (error instanceof TimeoutError) {
    return true;
  }
  return error instanceof HttpErrorResponse && (error.status === 0 || error.status === 429 || error.status >= 500);
}

/**
 * Carries the WebRTC handshake between players through the backend, which only relays messages.
 *
 * A player who joins a lobby offers a connection to everyone already in it; the players already
 * there only answer. That way each pair has exactly one initiator without any extra coordination.
 */
@Injectable({
  providedIn: 'root'
})
export class SignalingService implements OnDestroy {
  private session: Session | null = null;
  private pollSubscription: Subscription | null = null;
  private relaySubscription: Subscription | null = null;
  private pollFailures = 0;
  private readonly outboxes = new Map<string, Outbox>();
  private readonly retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly retryCounts = new Map<string, number>();

  public peerJoined$ = new Subject<string>();
  public peerLeft$ = new Subject<string>();

  constructor(
    private http: HttpClient,
    private webrtcService: WebRTCService
  ) {}

  ngOnDestroy(): void {
    this.cleanup();
  }

  /**
   * Starts relaying handshake messages for a lobby. Safe to call again for the same lobby and user.
   */
  async initializeForLobby(lobbyId: string, userId: string): Promise<void> {
    if (this.session?.lobbyId !== lobbyId || this.session.userId !== userId) {
      this.cleanup();
      const session: Session = { lobbyId, userId };
      this.session = session;
      this.relaySubscription = new Subscription();
      this.relaySubscription.add(
        this.webrtcService.iceCandidates$.subscribe(candidate => this.queueCandidate(session, candidate))
      );
      this.relaySubscription.add(
        this.webrtcService.peerStatus$.subscribe(change => this.onPeerStatus(session, change))
      );
    }
    this.startPolling();
  }

  /**
   * Offers a connection to every one of these players. Call it once after joining the lobby.
   */
  async connectToExistingPeers(peerIds: string[]): Promise<void> {
    for (const peerId of new Set(peerIds)) {
      await this.initiateConnectionToPeer(peerId);
    }
  }

  /**
   * Offers a connection to a player, replacing whatever connection exists with them.
   */
  async initiateConnectionToPeer(peerId: string): Promise<void> {
    const session = this.session;
    if (!session || !isId(peerId) || peerId === session.userId) {
      return;
    }
    this.cancelRetry(peerId);
    try {
      const offer = await this.webrtcService.createOffer(peerId);
      if (offer && this.session === session) {
        this.sendDescription(session, peerId, offer.connectionId, 'offer', offer.description);
      }
    } catch (error) {
      // The failed connection also reports itself, which schedules the automatic retry
      console.error('Error initiating connection to peer:', error);
    }
  }

  /**
   * Starts over with a player, for when a connection failed and the automatic retries ran out.
   */
  async retryPeer(peerId: string): Promise<void> {
    this.retryCounts.delete(peerId);
    await this.initiateConnectionToPeer(peerId);
  }

  stopPolling(): void {
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = null;
  }

  notifyJoined(lobbyId: string, userId: string): Observable<any> {
    return this.http.post(`/api/lobby/${encodeURIComponent(lobbyId)}/notify-joined`, { userId });
  }

  notifyLeft(lobbyId: string, userId: string): Observable<any> {
    return this.http.post(`/api/lobby/${encodeURIComponent(lobbyId)}/notify-left`, { userId });
  }

  /**
   * Stops signaling and forgets everything queued. Existing peer connections are left to the caller.
   */
  cleanup(): void {
    this.stopPolling();
    this.relaySubscription?.unsubscribe();
    this.relaySubscription = null;
    this.retryTimers.forEach(timerId => clearTimeout(timerId));
    this.retryTimers.clear();
    this.retryCounts.clear();
    Array.from(this.outboxes.keys()).forEach(peerId => this.dropOutbox(peerId));
    this.session = null;
    this.pollFailures = 0;
  }

  private startPolling(): void {
    const session = this.session;
    if (!session || this.pollSubscription) {
      return;
    }
    // No immediate first poll: the server clears this user's stale queue when they announce they joined.
    // exhaustMap never overlaps polls, which matters because reading a queue also empties it.
    this.pollSubscription = timer(SIGNALING_POLL_INTERVAL_MS, SIGNALING_POLL_INTERVAL_MS)
      .pipe(exhaustMap(() => this.pollSignalingMessages(session)))
      .subscribe();
  }

  private async pollSignalingMessages(session: Session): Promise<void> {
    try {
      const messages = await firstValueFrom(
        this.getSignalingMessages(session.lobbyId, session.userId).pipe(timeout(REQUEST_TIMEOUT_MS))
      );
      this.pollFailures = 0;
      if (!Array.isArray(messages)) {
        return;
      }
      for (const message of messages) {
        if (this.session !== session) {
          return;
        }
        await this.handleSignalingMessage(session, message);
      }
    } catch (error) {
      // A poll that fails after the lobby was left is of no interest
      if (this.session === session && this.pollFailures++ === 0) {
        console.error('Error polling signaling messages:', error);
      }
    }
  }

  private async handleSignalingMessage(session: Session, message: SignalingMessage): Promise<void> {
    if (!message || !isId(message.from) || message.from === session.userId) {
      return;
    }
    try {
      switch (message.type) {
        case 'offer':
          await this.handleOffer(session, message.from, message.connectionId, message.payload);
          break;
        case 'answer':
          await this.handleAnswer(message.from, message.connectionId, message.payload);
          break;
        case 'ice-candidate':
          await this.handleIceCandidates(message.from, message.connectionId, message.payload);
          break;
        case 'peer-joined':
          // Newcomers offer connections themselves; this only tells the lobby the roster changed
          this.peerJoined$.next(message.from);
          break;
        case 'peer-left':
          this.handlePeerLeft(message.from);
          break;
      }
    } catch (error) {
      console.error('Error handling signaling message:', error);
    }
  }

  private async handleOffer(session: Session, from: string, connectionId: unknown, payload: unknown): Promise<void> {
    const offer = parseDescription(payload, 'offer');
    if (!isId(connectionId) || !offer) {
      return;
    }
    if (this.webrtcService.isCurrentConnection(from, connectionId)) {
      // The same offer delivered twice must not tear down the connection it already produced
      return;
    }
    if (this.webrtcService.hasPendingLocalOffer(from) && session.userId < from) {
      // Both sides offered at once: the lower id keeps its offer and the other side answers it
      return;
    }
    const answer = await this.webrtcService.createAnswer(from, connectionId, offer);
    if (answer && this.session === session) {
      this.sendDescription(session, from, connectionId, 'answer', answer);
    }
  }

  private async handleAnswer(from: string, connectionId: unknown, payload: unknown): Promise<void> {
    const answer = parseDescription(payload, 'answer');
    if (!isId(connectionId) || !answer) {
      return;
    }
    await this.webrtcService.setRemoteAnswer(from, connectionId, answer);
  }

  private async handleIceCandidates(from: string, connectionId: unknown, payload: unknown): Promise<void> {
    if (!isId(connectionId)) {
      return;
    }
    const received = Array.isArray(payload) ? payload : [payload];
    for (const item of received.slice(0, MAX_CANDIDATES_PER_MESSAGE)) {
      const candidate = parseCandidate(item);
      if (candidate) {
        await this.webrtcService.addIceCandidate(from, connectionId, candidate);
      }
    }
  }

  private handlePeerLeft(peerId: string): void {
    this.cancelRetry(peerId);
    this.retryCounts.delete(peerId);
    this.dropOutbox(peerId);
    this.webrtcService.closePeerConnection(peerId);
    this.peerLeft$.next(peerId);
  }

  private onPeerStatus(session: Session, change: PeerStatusChange): void {
    if (change.status === 'connected') {
      this.retryCounts.delete(change.peerId);
    } else if (change.status === 'failed' && change.isInitiator) {
      this.scheduleRetry(session, change.peerId);
    }
  }

  // Only the side that started the connection retries, so the two sides never retry against each other
  private scheduleRetry(session: Session, peerId: string): void {
    const attempt = this.retryCounts.get(peerId) ?? 0;
    if (attempt >= CONNECT_RETRY_DELAYS_MS.length || this.retryTimers.has(peerId)) {
      return;
    }
    this.retryCounts.set(peerId, attempt + 1);
    this.retryTimers.set(
      peerId,
      setTimeout(() => {
        this.retryTimers.delete(peerId);
        if (this.session === session && this.webrtcService.getPeerStatus(peerId) === 'failed') {
          void this.initiateConnectionToPeer(peerId);
        }
      }, CONNECT_RETRY_DELAYS_MS[attempt])
    );
  }

  private cancelRetry(peerId: string): void {
    const timerId = this.retryTimers.get(peerId);
    if (timerId !== undefined) {
      clearTimeout(timerId);
      this.retryTimers.delete(peerId);
    }
  }

  private sendDescription(
    session: Session,
    peerId: string,
    connectionId: string,
    type: 'offer' | 'answer',
    description: RTCSessionDescriptionInit
  ): void {
    const batch = this.batchFor(peerId, connectionId);
    batch.descriptionQueued = true;
    this.enqueue(session, peerId, connectionId, { type, from: session.userId, to: peerId, connectionId, payload: description });
    // Candidates gathered while the description was still being created follow it straight away
    this.flushCandidates(session, peerId, connectionId, batch);
  }

  private queueCandidate(session: Session, { peerId, connectionId, candidate }: LocalIceCandidate): void {
    const batch = this.batchFor(peerId, connectionId);
    batch.candidates.push(candidate);
    if (batch.descriptionQueued && !batch.timer) {
      batch.timer = setTimeout(() => this.flushCandidates(session, peerId, connectionId, batch), CANDIDATE_BATCH_MS);
    }
  }

  private flushCandidates(session: Session, peerId: string, connectionId: string, batch: CandidateBatch): void {
    if (batch.timer) {
      clearTimeout(batch.timer);
      batch.timer = null;
    }
    const candidates = batch.candidates.splice(0);
    if (candidates.length > 0) {
      this.enqueue(session, peerId, connectionId, {
        type: 'ice-candidate',
        from: session.userId,
        to: peerId,
        connectionId,
        payload: candidates
      });
    }
  }

  private batchFor(peerId: string, connectionId: string): CandidateBatch {
    let outbox = this.outboxes.get(peerId);
    if (!outbox) {
      outbox = { tail: Promise.resolve(), batches: new Map() };
      this.outboxes.set(peerId, outbox);
    }
    let batch = outbox.batches.get(connectionId);
    if (!batch) {
      batch = { candidates: [], timer: null, descriptionQueued: false };
      outbox.batches.set(connectionId, batch);
      if (outbox.batches.size > MAX_TRACKED_ATTEMPTS) {
        const oldest = outbox.batches.keys().next().value as string;
        const stale = outbox.batches.get(oldest);
        if (stale?.timer) {
          clearTimeout(stale.timer);
        }
        outbox.batches.delete(oldest);
      }
    }
    return batch;
  }

  private dropOutbox(peerId: string): void {
    this.outboxes.get(peerId)?.batches.forEach(batch => {
      if (batch.timer) {
        clearTimeout(batch.timer);
      }
    });
    this.outboxes.delete(peerId);
  }

  private enqueue(session: Session, peerId: string, connectionId: string, message: SignalingMessage): void {
    const outbox = this.outboxes.get(peerId);
    if (outbox) {
      outbox.tail = outbox.tail.then(() => this.post(session, peerId, connectionId, message));
    }
  }

  private async post(session: Session, peerId: string, connectionId: string, message: SignalingMessage): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      // Whatever belongs to a connection that has since been replaced or closed is no use to anyone
      if (this.session !== session || !this.webrtcService.isCurrentConnection(peerId, connectionId)) {
        return;
      }
      try {
        await firstValueFrom(this.sendSignalingMessage(session.lobbyId, message).pipe(timeout(REQUEST_TIMEOUT_MS)));
        return;
      } catch (error) {
        if (!isTransient(error) || attempt >= SEND_RETRY_DELAYS_MS.length) {
          console.error(`Could not send ${message.type} to peer:`, error);
          return;
        }
        await new Promise<void>(resolve => setTimeout(resolve, SEND_RETRY_DELAYS_MS[attempt]));
      }
    }
  }

  private sendSignalingMessage(lobbyId: string, message: SignalingMessage): Observable<any> {
    return this.http.post(`/api/lobby/${encodeURIComponent(lobbyId)}/signal`, message);
  }

  private getSignalingMessages(lobbyId: string, userId: string): Observable<SignalingMessage[]> {
    return this.http.get<SignalingMessage[]>(
      `/api/lobby/${encodeURIComponent(lobbyId)}/signal/${encodeURIComponent(userId)}`
    );
  }
}

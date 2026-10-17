import { Injectable, InjectionToken, NgZone, OnDestroy, inject } from '@angular/core';
import { Subject } from 'rxjs';

export interface DataChannelMessage {
  type: string;
  data: any;
  from: string;
}

export type PeerStatus = 'connecting' | 'connected' | 'disconnected' | 'failed';

export interface PeerStatusChange {
  peerId: string;
  status: PeerStatus;
  isInitiator: boolean;
}

/** An ICE candidate gathered locally, tagged with the connection attempt it belongs to. */
export interface LocalIceCandidate {
  peerId: string;
  connectionId: string;
  candidate: RTCIceCandidateInit;
}

export interface LocalOffer {
  connectionId: string;
  description: RTCSessionDescriptionInit;
}

/**
 * Games run peer to peer over STUN only. There is deliberately no TURN relay, so game data never
 * passes through a third party. The trade-off is that a few network pairs (for example two
 * symmetric NATs) cannot reach each other.
 */
export const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export type PeerConnectionFactory = (configuration: RTCConfiguration) => RTCPeerConnection;

export const PEER_CONNECTION_FACTORY = new InjectionToken<PeerConnectionFactory>('PEER_CONNECTION_FACTORY', {
  providedIn: 'root',
  factory: () => (configuration: RTCConfiguration) => new RTCPeerConnection(configuration)
});

// A connection that has not opened its data channel by then is given up on
export const CONNECT_TIMEOUT_MS = 20000;
// ICE reports "disconnected" for transient network blips; wait this long for it to recover
export const DISCONNECT_GRACE_MS = 8000;

const MAX_BUFFERED_CANDIDATES = 50;
const MAX_BUFFERED_CONNECTIONS = 3;

interface PeerEntry {
  peerId: string;
  // Identifies one negotiation attempt; answers and candidates from other attempts are ignored
  connectionId: string;
  isInitiator: boolean;
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  status: PeerStatus;
  remoteDescriptionSet: boolean;
  // Candidates received before the remote description could be applied
  pendingCandidates: RTCIceCandidateInit[];
  connectTimer: ReturnType<typeof setTimeout> | null;
  graceTimer: ReturnType<typeof setTimeout> | null;
}

function randomId(): string {
  // crypto.randomUUID is unavailable on plain-http origins, getRandomValues is not
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Owns the RTCPeerConnections and their data channels, one per remote player. It knows nothing
 * about signaling: callers pass descriptions and candidates in and out.
 */
@Injectable({
  providedIn: 'root'
})
export class WebRTCService implements OnDestroy {
  private readonly zone = inject(NgZone);
  private readonly createConnection = inject(PEER_CONNECTION_FACTORY);
  private readonly peers = new Map<string, PeerEntry>();
  // Candidates that arrive before the offer they belong to: peerId -> connectionId -> candidates
  private readonly earlyCandidates = new Map<string, Map<string, RTCIceCandidateInit[]>>();

  public dataChannelMessage$ = new Subject<DataChannelMessage>();
  /** Fires when the data channel to a peer opens. */
  public peerConnected$ = new Subject<string>();
  /** Fires when a connection that was up is lost for good. */
  public peerDisconnected$ = new Subject<string>();
  public peerStatus$ = new Subject<PeerStatusChange>();
  public iceCandidates$ = new Subject<LocalIceCandidate>();

  ngOnDestroy(): void {
    this.closeAllConnections();
  }

  /**
   * Starts a new connection attempt to a peer, replacing any earlier one. Resolves to null if the
   * attempt was superseded or closed before the offer was ready.
   */
  async createOffer(peerId: string): Promise<LocalOffer | null> {
    const entry = this.openEntry(peerId, randomId(), true);
    try {
      this.attachDataChannel(entry, entry.connection.createDataChannel('game'));
      const description = await entry.connection.createOffer();
      if (!this.isCurrent(entry)) {
        return null;
      }
      await entry.connection.setLocalDescription(description);
      return this.isCurrent(entry) ? { connectionId: entry.connectionId, description } : null;
    } catch (error) {
      return this.negotiationFailed(entry, error);
    }
  }

  /**
   * Answers an offer. Any connection to that peer is replaced, including an offer of our own that
   * is still waiting for an answer; resolving to null means the attempt was superseded.
   */
  async createAnswer(
    peerId: string,
    connectionId: string,
    offer: RTCSessionDescriptionInit
  ): Promise<RTCSessionDescriptionInit | null> {
    const entry = this.openEntry(peerId, connectionId, false);
    try {
      entry.connection.ondatachannel = event => this.attachDataChannel(entry, event.channel);
      await entry.connection.setRemoteDescription(offer);
      if (!this.isCurrent(entry)) {
        return null;
      }
      await this.applyRemoteDescription(entry);
      const answer = await entry.connection.createAnswer();
      if (!this.isCurrent(entry)) {
        return null;
      }
      await entry.connection.setLocalDescription(answer);
      return this.isCurrent(entry) ? answer : null;
    } catch (error) {
      return this.negotiationFailed(entry, error);
    }
  }

  /**
   * Applies the answer to our offer. Returns false, without touching the connection, when the
   * answer belongs to an attempt that is no longer current or has already been applied.
   */
  async setRemoteAnswer(peerId: string, connectionId: string, answer: RTCSessionDescriptionInit): Promise<boolean> {
    const entry = this.peers.get(peerId);
    if (!entry || entry.connectionId !== connectionId || !entry.isInitiator || entry.remoteDescriptionSet) {
      return false;
    }
    try {
      await entry.connection.setRemoteDescription(answer);
      if (!this.isCurrent(entry)) {
        return false;
      }
      await this.applyRemoteDescription(entry);
      return true;
    } catch (error) {
      this.negotiationFailed(entry, error);
      return false;
    }
  }

  /**
   * Adds a candidate from a peer. Candidates that arrive early - before the offer they belong to,
   * or before the remote description is set - are held and applied as soon as they can be.
   */
  async addIceCandidate(peerId: string, connectionId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const entry = this.peers.get(peerId);
    if (!entry || entry.connectionId !== connectionId) {
      this.bufferEarlyCandidate(peerId, connectionId, candidate);
    } else if (entry.status === 'failed') {
      return;
    } else if (!entry.remoteDescriptionSet) {
      this.pushBounded(entry.pendingCandidates, candidate);
    } else {
      await this.tryAddCandidate(entry, candidate);
    }
  }

  /** True while we have offered (or are about to) and no answer has been applied yet. */
  hasPendingLocalOffer(peerId: string): boolean {
    const entry = this.peers.get(peerId);
    return !!entry && entry.isInitiator && !entry.remoteDescriptionSet && entry.status === 'connecting';
  }

  /** True while this attempt is the live connection to the peer, i.e. it was not replaced, closed or failed. */
  isCurrentConnection(peerId: string, connectionId: string): boolean {
    const entry = this.peers.get(peerId);
    return !!entry && entry.connectionId === connectionId && entry.status !== 'failed';
  }

  isInitiator(peerId: string): boolean {
    return this.peers.get(peerId)?.isInitiator ?? false;
  }

  getPeerStatus(peerId: string): PeerStatus | null {
    return this.peers.get(peerId)?.status ?? null;
  }

  /** Peers whose data channel is up. */
  getConnectedPeers(): string[] {
    return Array.from(this.peers.values())
      .filter(entry => entry.status === 'connected')
      .map(entry => entry.peerId);
  }

  isPeerConnected(peerId: string): boolean {
    const entry = this.peers.get(peerId);
    return entry?.status === 'connected' && entry.dataChannel?.readyState === 'open';
  }

  sendToPeer(peerId: string, type: string, data: any): boolean {
    const channel = this.peers.get(peerId)?.dataChannel;
    if (channel?.readyState !== 'open') {
      return false;
    }
    try {
      channel.send(JSON.stringify({ type, data }));
      return true;
    } catch (error) {
      console.error('Error sending data channel message:', error);
      return false;
    }
  }

  broadcast(type: string, data: any): void {
    this.peers.forEach((_, peerId) => this.sendToPeer(peerId, type, data));
  }

  closePeerConnection(peerId: string): void {
    const entry = this.peers.get(peerId);
    this.earlyCandidates.delete(peerId);
    if (entry) {
      this.peers.delete(peerId);
      this.discard(entry);
    }
  }

  closeAllConnections(): void {
    const entries = Array.from(this.peers.values());
    this.peers.clear();
    this.earlyCandidates.clear();
    entries.forEach(entry => this.discard(entry));
  }

  private isCurrent(entry: PeerEntry): boolean {
    return this.peers.get(entry.peerId) === entry;
  }

  private emit(notify: () => void): void {
    // Browser callbacks for peer connections run outside Angular's zone; re-enter it so views update
    this.zone.run(notify);
  }

  private openEntry(peerId: string, connectionId: string, isInitiator: boolean): PeerEntry {
    const previous = this.peers.get(peerId);
    if (previous) {
      this.peers.delete(peerId);
      this.discard(previous);
    }

    const entry: PeerEntry = {
      peerId,
      connectionId,
      isInitiator,
      connection: this.createConnection(RTC_CONFIGURATION),
      dataChannel: null,
      status: 'connecting',
      remoteDescriptionSet: false,
      pendingCandidates: this.takeEarlyCandidates(peerId, connectionId),
      connectTimer: null,
      graceTimer: null
    };
    this.peers.set(peerId, entry);

    // Handlers must be in place before any description is set, or early candidates are lost
    entry.connection.onicecandidate = event => {
      if (event.candidate && this.isCurrent(entry)) {
        const candidate = event.candidate.toJSON();
        this.emit(() => this.iceCandidates$.next({ peerId, connectionId, candidate }));
      }
    };
    entry.connection.oniceconnectionstatechange = () => this.onIceStateChange(entry);
    entry.connectTimer = setTimeout(() => this.fail(entry), CONNECT_TIMEOUT_MS);
    this.emitStatus(entry);
    return entry;
  }

  private attachDataChannel(entry: PeerEntry, channel: RTCDataChannel): void {
    if (!this.isCurrent(entry)) {
      channel.close();
      return;
    }
    entry.dataChannel = channel;
    channel.onopen = () => this.onChannelOpen(entry);
    channel.onclose = () => {
      if (entry.dataChannel === channel) {
        this.fail(entry);
      }
    };
    channel.onerror = () => console.error(`Data channel error with peer ${entry.peerId}`);
    channel.onmessage = event => this.onChannelMessage(entry, event);
    if (channel.readyState === 'open') {
      this.onChannelOpen(entry);
    }
  }

  private onChannelOpen(entry: PeerEntry): void {
    if (!this.isCurrent(entry) || entry.status === 'connected' || entry.status === 'failed') {
      return;
    }
    this.clearTimers(entry);
    this.earlyCandidates.delete(entry.peerId);
    this.setStatus(entry, 'connected');
    this.emit(() => this.peerConnected$.next(entry.peerId));
  }

  private onChannelMessage(entry: PeerEntry, event: MessageEvent): void {
    if (!this.isCurrent(entry) || typeof event.data !== 'string') {
      return;
    }
    let message: { type?: unknown; data?: unknown } | null;
    try {
      message = JSON.parse(event.data);
    } catch {
      console.error('Ignoring malformed data channel message');
      return;
    }
    if (typeof message !== 'object' || message === null || typeof message.type !== 'string') {
      return;
    }
    const { type, data } = message as { type: string; data: unknown };
    // The sender is the peer this connection was negotiated with, never something the payload claims
    this.emit(() => this.dataChannelMessage$.next({ type, data, from: entry.peerId }));
  }

  private onIceStateChange(entry: PeerEntry): void {
    if (!this.isCurrent(entry)) {
      return;
    }
    switch (entry.connection.iceConnectionState) {
      case 'connected':
      case 'completed':
        if (entry.status === 'disconnected' && entry.dataChannel?.readyState === 'open') {
          this.clearTimers(entry);
          this.setStatus(entry, 'connected');
        }
        break;
      case 'disconnected':
        if (entry.status === 'connected') {
          this.setStatus(entry, 'disconnected');
          entry.graceTimer = setTimeout(() => this.fail(entry), DISCONNECT_GRACE_MS);
        }
        break;
      case 'failed':
        this.fail(entry);
        break;
    }
  }

  private async applyRemoteDescription(entry: PeerEntry): Promise<void> {
    entry.remoteDescriptionSet = true;
    for (const candidate of entry.pendingCandidates.splice(0)) {
      if (!this.isCurrent(entry)) {
        return;
      }
      await this.tryAddCandidate(entry, candidate);
    }
  }

  private async tryAddCandidate(entry: PeerEntry, candidate: RTCIceCandidateInit): Promise<void> {
    try {
      await entry.connection.addIceCandidate(candidate);
    } catch (error) {
      // A candidate from a superseded attempt or a bad peer must not break the connection
      if (this.isCurrent(entry)) {
        console.warn('Ignoring an ICE candidate that could not be added:', error instanceof Error ? error.message : error);
      }
    }
  }

  private bufferEarlyCandidate(peerId: string, connectionId: string, candidate: RTCIceCandidateInit): void {
    const byConnection = this.earlyCandidates.get(peerId) ?? new Map<string, RTCIceCandidateInit[]>();
    const buffered = byConnection.get(connectionId) ?? [];
    this.pushBounded(buffered, candidate);
    byConnection.set(connectionId, buffered);
    while (byConnection.size > MAX_BUFFERED_CONNECTIONS) {
      byConnection.delete(byConnection.keys().next().value as string);
    }
    this.earlyCandidates.set(peerId, byConnection);
  }

  // Hands over what was buffered for this attempt and drops what was buffered for older ones
  private takeEarlyCandidates(peerId: string, connectionId: string): RTCIceCandidateInit[] {
    const taken = this.earlyCandidates.get(peerId)?.get(connectionId) ?? [];
    this.earlyCandidates.delete(peerId);
    return taken;
  }

  private pushBounded(list: RTCIceCandidateInit[], candidate: RTCIceCandidateInit): void {
    if (list.length >= MAX_BUFFERED_CANDIDATES) {
      list.shift();
    }
    list.push(candidate);
  }

  private setStatus(entry: PeerEntry, status: PeerStatus): void {
    entry.status = status;
    this.emitStatus(entry);
  }

  private emitStatus(entry: PeerEntry): void {
    this.emit(() => this.peerStatus$.next({ peerId: entry.peerId, status: entry.status, isInitiator: entry.isInitiator }));
  }

  // Gives up on the connection for good; a new attempt needs a new offer
  private fail(entry: PeerEntry): void {
    if (!this.isCurrent(entry) || entry.status === 'failed') {
      return;
    }
    const wasUp = entry.status === 'connected' || entry.status === 'disconnected';
    this.setStatus(entry, 'failed');
    this.discard(entry);
    if (wasUp) {
      this.emit(() => this.peerDisconnected$.next(entry.peerId));
    }
  }

  private negotiationFailed(entry: PeerEntry, error: unknown): null {
    if (this.isCurrent(entry)) {
      this.fail(entry);
      throw error;
    }
    return null;
  }

  private clearTimers(entry: PeerEntry): void {
    if (entry.connectTimer) {
      clearTimeout(entry.connectTimer);
      entry.connectTimer = null;
    }
    if (entry.graceTimer) {
      clearTimeout(entry.graceTimer);
      entry.graceTimer = null;
    }
  }

  // Stops the connection and silences its handlers; the entry itself stays wherever the caller put it
  private discard(entry: PeerEntry): void {
    this.clearTimers(entry);
    const { connection, dataChannel } = entry;
    connection.onicecandidate = null;
    connection.oniceconnectionstatechange = null;
    connection.ondatachannel = null;
    if (dataChannel) {
      dataChannel.onopen = null;
      dataChannel.onclose = null;
      dataChannel.onerror = null;
      dataChannel.onmessage = null;
      dataChannel.close();
    }
    connection.close();
  }
}

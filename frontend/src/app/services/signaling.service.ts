import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, interval, firstValueFrom } from 'rxjs';
import { WebRTCService } from './webrtc.service';

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'peer-joined' | 'peer-left';
  from: string;
  to: string;
  payload?: any;
}

// Polling interval in milliseconds
const SIGNALING_POLL_INTERVAL_MS = 2000;

@Injectable({
  providedIn: 'root'
})
export class SignalingService {
  private lobbyId: string | null = null;
  private userId: string | null = null;
  private pollingInterval: any = null;
  
  public peerJoined$ = new Subject<string>();
  public peerLeft$ = new Subject<string>();

  constructor(
    private http: HttpClient,
    private webrtcService: WebRTCService
  ) {}

  /**
   * Initialize signaling for a lobby
   */
  async initializeForLobby(lobbyId: string, userId: string): Promise<void> {
    this.lobbyId = lobbyId;
    this.userId = userId;
    
    // Start polling for signaling messages
    this.startPolling();
  }

  /**
   * Start polling for signaling messages
   */
  private startPolling(): void {
    if (this.pollingInterval) {
      return;
    }

    // Poll for signaling messages
    this.pollingInterval = setInterval(() => {
      this.pollSignalingMessages();
    }, SIGNALING_POLL_INTERVAL_MS);
  }

  /**
   * Stop polling for signaling messages
   */
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Poll for signaling messages from the server
   */
  private async pollSignalingMessages(): Promise<void> {
    if (!this.lobbyId || !this.userId) {
      return;
    }

    try {
      const messages = await firstValueFrom(this.getSignalingMessages(this.lobbyId, this.userId));
      if (messages && Array.isArray(messages)) {
        for (const message of messages) {
          await this.handleSignalingMessage(message);
        }
      }
    } catch (error) {
      console.error('Error polling signaling messages:', error);
    }
  }

  /**
   * Handle incoming signaling message
   */
  private async handleSignalingMessage(message: SignalingMessage): Promise<void> {
    try {
      switch (message.type) {
        case 'offer':
          await this.handleOffer(message.from, message.payload);
          break;
        case 'answer':
          await this.handleAnswer(message.from, message.payload);
          break;
        case 'ice-candidate':
          await this.handleIceCandidate(message.from, message.payload);
          break;
        case 'peer-joined':
          this.peerJoined$.next(message.from);
          // Initiate connection if we're already in the lobby
          if (this.userId && message.from !== this.userId) {
            await this.initiateConnectionToPeer(message.from);
          }
          break;
        case 'peer-left':
          this.peerLeft$.next(message.from);
          this.webrtcService.closePeerConnection(message.from);
          break;
      }
    } catch (error) {
      console.error('Error handling signaling message:', error);
    }
  }

  /**
   * Initiate a WebRTC connection to a peer
   */
  async initiateConnectionToPeer(peerId: string): Promise<void> {
    try {
      const offer = await this.webrtcService.createOffer(peerId);
      
      // Setup ICE candidate handler
      this.webrtcService.onIceCandidate(peerId, (candidate) => {
        if (candidate) {
          this.sendIceCandidate(peerId, candidate);
        }
      });

      await this.sendOffer(peerId, offer);
    } catch (error) {
      console.error('Error initiating connection to peer:', error);
    }
  }

  /**
   * Handle incoming offer
   */
  private async handleOffer(fromPeer: string, offer: RTCSessionDescriptionInit): Promise<void> {
    try {
      const answer = await this.webrtcService.createAnswer(fromPeer, offer);
      
      // Setup ICE candidate handler
      this.webrtcService.onIceCandidate(fromPeer, (candidate) => {
        if (candidate) {
          this.sendIceCandidate(fromPeer, candidate);
        }
      });

      await this.sendAnswer(fromPeer, answer);
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }

  /**
   * Handle incoming answer
   */
  private async handleAnswer(fromPeer: string, answer: RTCSessionDescriptionInit): Promise<void> {
    try {
      await this.webrtcService.setRemoteAnswer(fromPeer, answer);
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  /**
   * Handle incoming ICE candidate
   */
  private async handleIceCandidate(fromPeer: string, candidate: RTCIceCandidateInit): Promise<void> {
    try {
      await this.webrtcService.addIceCandidate(fromPeer, candidate);
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }

  /**
   * Send offer to peer via signaling server
   */
  private async sendOffer(toPeer: string, offer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.lobbyId || !this.userId) return;
    
    const message: SignalingMessage = {
      type: 'offer',
      from: this.userId,
      to: toPeer,
      payload: offer
    };

    await firstValueFrom(this.sendSignalingMessage(this.lobbyId, message));
  }

  /**
   * Send answer to peer via signaling server
   */
  private async sendAnswer(toPeer: string, answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.lobbyId || !this.userId) return;
    
    const message: SignalingMessage = {
      type: 'answer',
      from: this.userId,
      to: toPeer,
      payload: answer
    };

    await firstValueFrom(this.sendSignalingMessage(this.lobbyId, message));
  }

  /**
   * Send ICE candidate to peer via signaling server
   */
  private async sendIceCandidate(toPeer: string, candidate: RTCIceCandidate): Promise<void> {
    if (!this.lobbyId || !this.userId) return;
    
    const message: SignalingMessage = {
      type: 'ice-candidate',
      from: this.userId,
      to: toPeer,
      payload: candidate.toJSON()
    };

    await firstValueFrom(this.sendSignalingMessage(this.lobbyId, message));
  }

  /**
   * Send signaling message to server
   */
  private sendSignalingMessage(lobbyId: string, message: SignalingMessage): Observable<any> {
    return this.http.post(`/api/lobby/${lobbyId}/signal`, message);
  }

  /**
   * Get signaling messages from server
   */
  private getSignalingMessages(lobbyId: string, userId: string): Observable<SignalingMessage[]> {
    return this.http.get<SignalingMessage[]>(`/api/lobby/${lobbyId}/signal/${userId}`);
  }

  /**
   * Notify server that user joined lobby
   */
  notifyJoined(lobbyId: string, userId: string): Observable<any> {
    return this.http.post(`/api/lobby/${lobbyId}/notify-joined`, { userId });
  }

  /**
   * Notify server that user left lobby
   */
  notifyLeft(lobbyId: string, userId: string): Observable<any> {
    return this.http.post(`/api/lobby/${lobbyId}/notify-left`, { userId });
  }

  /**
   * Cleanup signaling
   */
  cleanup(): void {
    this.stopPolling();
    this.lobbyId = null;
    this.userId = null;
  }
}

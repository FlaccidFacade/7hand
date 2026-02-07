import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface DataChannelMessage {
  type: string;
  data: any;
  from: string;
}

export interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
}

@Injectable({
  providedIn: 'root'
})
export class WebRTCService {
  private peerConnections = new Map<string, PeerConnection>();
  private localStream: MediaStream | null = null;
  
  // Observables for events
  public dataChannelMessage$ = new Subject<DataChannelMessage>();
  public peerConnected$ = new Subject<string>();
  public peerDisconnected$ = new Subject<string>();

  private configuration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  constructor() {}

  /**
   * Create a new peer connection for a specific peer
   */
  async createPeerConnection(peerId: string, isInitiator: boolean = false): Promise<RTCPeerConnection> {
    if (this.peerConnections.has(peerId)) {
      const existing = this.peerConnections.get(peerId);
      if (existing?.connection.connectionState !== 'closed') {
        return existing.connection;
      }
    }

    const peerConnection = new RTCPeerConnection(this.configuration);
    let dataChannel: RTCDataChannel | null = null;

    // Create data channel if initiator
    if (isInitiator) {
      dataChannel = peerConnection.createDataChannel('gameState');
      this.setupDataChannel(dataChannel, peerId);
    } else {
      // Wait for data channel from remote peer
      peerConnection.ondatachannel = (event) => {
        dataChannel = event.channel;
        this.setupDataChannel(dataChannel, peerId);
        const pc = this.peerConnections.get(peerId);
        if (pc) {
          pc.dataChannel = dataChannel;
        }
      };
    }

    // Handle ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      if (peerConnection.iceConnectionState === 'connected') {
        this.peerConnected$.next(peerId);
      } else if (peerConnection.iceConnectionState === 'disconnected' || 
                 peerConnection.iceConnectionState === 'failed' ||
                 peerConnection.iceConnectionState === 'closed') {
        this.peerDisconnected$.next(peerId);
      }
    };

    this.peerConnections.set(peerId, {
      peerId,
      connection: peerConnection,
      dataChannel
    });

    return peerConnection;
  }

  /**
   * Setup data channel event handlers
   */
  private setupDataChannel(dataChannel: RTCDataChannel, peerId: string): void {
    dataChannel.onopen = () => {
      console.log(`Data channel opened with peer ${peerId}`);
    };

    dataChannel.onclose = () => {
      console.log(`Data channel closed with peer ${peerId}`);
    };

    dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.dataChannelMessage$.next({
          type: message.type,
          data: message.data,
          from: peerId
        });
      } catch (error) {
        console.error('Error parsing data channel message:', error);
      }
    };
  }

  /**
   * Create an offer for a peer
   */
  async createOffer(peerId: string): Promise<RTCSessionDescriptionInit> {
    const peerConnection = await this.createPeerConnection(peerId, true);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    return offer;
  }

  /**
   * Create an answer for a peer's offer
   */
  async createAnswer(peerId: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    const peerConnection = await this.createPeerConnection(peerId, false);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    return answer;
  }

  /**
   * Set remote description (answer) for a peer
   */
  async setRemoteAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const peer = this.peerConnections.get(peerId);
    if (!peer) {
      throw new Error(`No peer connection found for ${peerId}`);
    }
    await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  /**
   * Add ICE candidate from remote peer
   */
  async addIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peer = this.peerConnections.get(peerId);
    if (!peer) {
      throw new Error(`No peer connection found for ${peerId}`);
    }
    await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  /**
   * Get ICE candidates for a peer
   */
  onIceCandidate(peerId: string, callback: (candidate: RTCIceCandidate | null) => void): void {
    const peer = this.peerConnections.get(peerId);
    if (peer) {
      peer.connection.onicecandidate = (event) => {
        callback(event.candidate);
      };
    }
  }

  /**
   * Send data to a specific peer
   */
  sendToPeer(peerId: string, type: string, data: any): boolean {
    const peer = this.peerConnections.get(peerId);
    if (peer?.dataChannel?.readyState === 'open') {
      const message = JSON.stringify({ type, data });
      peer.dataChannel.send(message);
      return true;
    }
    return false;
  }

  /**
   * Broadcast data to all connected peers
   */
  broadcast(type: string, data: any): void {
    this.peerConnections.forEach((peer, peerId) => {
      this.sendToPeer(peerId, type, data);
    });
  }

  /**
   * Close connection with a specific peer
   */
  closePeerConnection(peerId: string): void {
    const peer = this.peerConnections.get(peerId);
    if (peer) {
      peer.dataChannel?.close();
      peer.connection.close();
      this.peerConnections.delete(peerId);
    }
  }

  /**
   * Close all peer connections
   */
  closeAllConnections(): void {
    this.peerConnections.forEach((peer) => {
      peer.dataChannel?.close();
      peer.connection.close();
    });
    this.peerConnections.clear();
  }

  /**
   * Get all connected peer IDs
   */
  getConnectedPeers(): string[] {
    return Array.from(this.peerConnections.keys());
  }

  /**
   * Check if peer is connected
   */
  isPeerConnected(peerId: string): boolean {
    const peer = this.peerConnections.get(peerId);
    return peer?.connection.iceConnectionState === 'connected' &&
           peer?.dataChannel?.readyState === 'open';
  }
}

import { PeerConnectionFactory } from '../webrtc.service';

/**
 * Minimal stand-ins for RTCPeerConnection and RTCDataChannel, so connection logic can be tested
 * deterministically without a network. Behaviour that matters to the code under test mirrors the
 * browser: adding a candidate before a remote description is set rejects.
 */

export class FakeDataChannel {
  readyState: RTCDataChannelState = 'connecting';
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  readonly sent: string[] = [];
  sendError: Error | null = null;
  // The other end of the channel, when two fake connections are wired together
  remote: FakeDataChannel | null = null;

  constructor(readonly label: string) {}

  send(data: string): void {
    if (this.sendError) {
      throw this.sendError;
    }
    this.sent.push(data);
    this.remote?.receive(data);
  }

  close(): void {
    if (this.readyState === 'closed') {
      return;
    }
    this.readyState = 'closed';
    this.onclose?.();
    this.remote?.close();
  }

  open(): void {
    this.readyState = 'open';
    this.onopen?.();
  }

  receive(data: unknown): void {
    this.onmessage?.({ data });
  }
}

export class FakePeerConnection {
  private static nextId = 1;

  readonly id = FakePeerConnection.nextId++;
  iceConnectionState: RTCIceConnectionState = 'new';
  signalingState: RTCSignalingState = 'stable';
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  onicecandidate: ((event: { candidate: { toJSON(): RTCIceCandidateInit } | null }) => void) | null = null;
  ondatachannel: ((event: { channel: FakeDataChannel }) => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  readonly channels: FakeDataChannel[] = [];
  readonly addedCandidates: RTCIceCandidateInit[] = [];
  // Ordered log of the calls the code under test made, for sequencing assertions
  readonly calls: string[] = [];
  closed = false;
  rejectCandidates = false;
  // Runs inside setLocalDescription, where real browsers start gathering candidates
  onSetLocalDescription: (() => void) | null = null;

  constructor(readonly configuration: RTCConfiguration) {}

  createDataChannel(label: string): FakeDataChannel {
    this.calls.push('createDataChannel');
    const channel = new FakeDataChannel(label);
    this.channels.push(channel);
    return channel;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    this.calls.push('createOffer');
    return { type: 'offer', sdp: `offer-${this.id}` };
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    this.calls.push('createAnswer');
    return { type: 'answer', sdp: `answer-${this.id}` };
  }

  async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.calls.push('setLocalDescription');
    this.localDescription = description;
    this.signalingState = description.type === 'offer' ? 'have-local-offer' : 'stable';
    this.onSetLocalDescription?.();
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.calls.push('setRemoteDescription');
    this.remoteDescription = description;
    this.signalingState = description.type === 'offer' ? 'have-remote-offer' : 'stable';
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    this.calls.push('addIceCandidate');
    if (!this.remoteDescription) {
      throw new Error('InvalidStateError: the remote description has not been set');
    }
    if (this.rejectCandidates) {
      throw new Error('OperationError: bad candidate');
    }
    this.addedCandidates.push(candidate);
  }

  close(): void {
    this.calls.push('close');
    this.closed = true;
    this.iceConnectionState = 'closed';
  }

  gatherCandidate(candidate = `candidate-${this.id}-${this.calls.length}`): void {
    this.onicecandidate?.({ candidate: { toJSON: () => ({ candidate, sdpMid: '0', sdpMLineIndex: 0 }) } });
  }

  setIceState(state: RTCIceConnectionState): void {
    this.iceConnectionState = state;
    this.oniceconnectionstatechange?.();
  }

  // What the remote side's data channel looks like to the answerer
  announceChannel(channel: FakeDataChannel): void {
    this.ondatachannel?.({ channel });
  }
}

/** A factory for WebRTCService that hands out fakes and records them, newest last. */
export function fakePeerConnectionFactory(
  created: FakePeerConnection[],
  setup?: (connection: FakePeerConnection) => void
): PeerConnectionFactory {
  return configuration => {
    const connection = new FakePeerConnection(configuration);
    created.push(connection);
    setup?.(connection);
    return connection as unknown as RTCPeerConnection;
  };
}

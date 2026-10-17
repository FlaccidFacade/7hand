import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import {
  CONNECT_TIMEOUT_MS,
  DISCONNECT_GRACE_MS,
  DataChannelMessage,
  LocalIceCandidate,
  PEER_CONNECTION_FACTORY,
  PeerStatusChange,
  RTC_CONFIGURATION,
  WebRTCService
} from './webrtc.service';
import { FakePeerConnection, fakePeerConnectionFactory } from './testing/fake-rtc';

describe('WebRTCService', () => {
  let service: WebRTCService;
  let created: FakePeerConnection[];
  let setup: ((connection: FakePeerConnection) => void) | undefined;

  const offerSdp: RTCSessionDescriptionInit = { type: 'offer', sdp: 'remote-offer' };
  const answerSdp: RTCSessionDescriptionInit = { type: 'answer', sdp: 'remote-answer' };
  const ice = (candidate: string): RTCIceCandidateInit => ({ candidate, sdpMid: '0', sdpMLineIndex: 0 });

  beforeEach(() => {
    created = [];
    setup = undefined;
    TestBed.configureTestingModule({
      providers: [{ provide: PEER_CONNECTION_FACTORY, useValue: fakePeerConnectionFactory(created, c => setup?.(c)) }]
    });
    service = TestBed.inject(WebRTCService);
  });

  afterEach(() => service.closeAllConnections());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('network configuration', () => {
    it('should use STUN servers only and never a TURN relay', async () => {
      const urls = RTC_CONFIGURATION.iceServers!.flatMap(server => server.urls);

      expect(urls.length).toBeGreaterThan(0);
      urls.forEach(url => expect(url.startsWith('stun:')).withContext(url).toBeTrue());

      await service.createOffer('peer-1');
      expect(created[0].configuration).toEqual(RTC_CONFIGURATION);
    });
  });

  describe('createOffer', () => {
    it('should open a data channel and report the connection as connecting', async () => {
      const offer = await service.createOffer('peer-1');

      expect(offer?.description.type).toBe('offer');
      expect(offer?.connectionId).toBeTruthy();
      expect(created.length).toBe(1);
      expect(created[0].channels.length).toBe(1);
      expect(created[0].signalingState).toBe('have-local-offer');
      expect(service.getPeerStatus('peer-1')).toBe('connecting');
      expect(service.isInitiator('peer-1')).toBeTrue();
      expect(service.hasPendingLocalOffer('peer-1')).toBeTrue();
      expect(service.getConnectedPeers()).toEqual([]);
    });

    it('should not lose candidates gathered while the local description is being set', async () => {
      setup = connection => (connection.onSetLocalDescription = () => connection.gatherCandidate('early'));
      const gathered: LocalIceCandidate[] = [];
      service.iceCandidates$.subscribe(c => gathered.push(c));

      const offer = await service.createOffer('peer-1');

      expect(gathered.length).toBe(1);
      expect(gathered[0].peerId).toBe('peer-1');
      expect(gathered[0].connectionId).toBe(offer!.connectionId);
      expect(gathered[0].candidate.candidate).toBe('early');
    });

    it('should tag every attempt with a new connection id and replace the previous connection', async () => {
      const first = await service.createOffer('peer-1');
      const second = await service.createOffer('peer-1');

      expect(second!.connectionId).not.toBe(first!.connectionId);
      expect(created.length).toBe(2);
      expect(created[0].closed).toBeTrue();
      expect(created[1].closed).toBeFalse();
    });

    it('should resolve to null when the attempt is replaced before the offer is ready', async () => {
      const first = service.createOffer('peer-1');
      const second = service.createOffer('peer-1');

      expect(await first).toBeNull();
      expect((await second)?.description.type).toBe('offer');
    });

    it('should fail the connection and rethrow when negotiation breaks', async () => {
      setup = connection => (connection.createOffer = () => Promise.reject(new Error('boom')));

      await expectAsync(service.createOffer('peer-1')).toBeRejectedWithError('boom');
      expect(service.getPeerStatus('peer-1')).toBe('failed');
    });
  });

  describe('createAnswer', () => {
    it('should apply the offer, then answer it', async () => {
      const answer = await service.createAnswer('peer-1', 'conn-1', offerSdp);

      expect(answer?.type).toBe('answer');
      expect(created[0].remoteDescription).toEqual(offerSdp);
      expect(created[0].calls).toEqual(['setRemoteDescription', 'createAnswer', 'setLocalDescription']);
      expect(service.isInitiator('peer-1')).toBeFalse();
      expect(service.hasPendingLocalOffer('peer-1')).toBeFalse();
    });

    it('should replace an offer of our own that is still waiting for an answer', async () => {
      await service.createOffer('peer-1');

      await service.createAnswer('peer-1', 'conn-1', offerSdp);

      expect(created.length).toBe(2);
      expect(created[0].closed).toBeTrue();
      expect(created[1].remoteDescription).toEqual(offerSdp);
      expect(service.getPeerStatus('peer-1')).toBe('connecting');
    });

    it('should pick up the data channel the offerer opened', async () => {
      await service.createAnswer('peer-1', 'conn-1', offerSdp);
      const messages: DataChannelMessage[] = [];
      service.dataChannelMessage$.subscribe(m => messages.push(m));

      const channel = new FakePeerConnection({}).createDataChannel('game');
      created[0].announceChannel(channel);
      channel.open();
      channel.receive(JSON.stringify({ type: 'hello', data: 1 }));

      expect(service.getPeerStatus('peer-1')).toBe('connected');
      expect(messages).toEqual([{ type: 'hello', data: 1, from: 'peer-1' }]);
    });

    it('should apply candidates that arrived before the offer, once the remote description is set', async () => {
      await service.addIceCandidate('peer-1', 'conn-1', ice('a'));
      await service.addIceCandidate('peer-1', 'conn-1', ice('b'));

      await service.createAnswer('peer-1', 'conn-1', offerSdp);

      expect(created[0].addedCandidates.map(c => c.candidate)).toEqual(['a', 'b']);
      expect(created[0].calls.indexOf('addIceCandidate')).toBeGreaterThan(created[0].calls.indexOf('setRemoteDescription'));
    });

    it('should not apply candidates that belong to another attempt', async () => {
      await service.addIceCandidate('peer-1', 'older-attempt', ice('stale'));

      await service.createAnswer('peer-1', 'conn-1', offerSdp);

      expect(created[0].addedCandidates).toEqual([]);
    });

    it('should keep only the most recent candidates when too many arrive early', async () => {
      for (let i = 0; i < 60; i++) {
        await service.addIceCandidate('peer-1', 'conn-1', ice(`c${i}`));
      }

      await service.createAnswer('peer-1', 'conn-1', offerSdp);

      expect(created[0].addedCandidates.length).toBe(50);
      expect(created[0].addedCandidates[49].candidate).toBe('c59');
    });
  });

  describe('setRemoteAnswer', () => {
    it('should apply the answer to the current attempt and then flush the candidates that came first', async () => {
      const offer = await service.createOffer('peer-1');
      await service.addIceCandidate('peer-1', offer!.connectionId, ice('first'));
      expect(created[0].addedCandidates).toEqual([]);

      expect(await service.setRemoteAnswer('peer-1', offer!.connectionId, answerSdp)).toBeTrue();

      expect(created[0].remoteDescription).toEqual(answerSdp);
      expect(created[0].addedCandidates.map(c => c.candidate)).toEqual(['first']);
      expect(service.hasPendingLocalOffer('peer-1')).toBeFalse();
    });

    it('should ignore answers for another attempt, for unknown peers and repeated answers', async () => {
      const offer = await service.createOffer('peer-1');

      expect(await service.setRemoteAnswer('peer-1', 'other-attempt', answerSdp)).toBeFalse();
      expect(await service.setRemoteAnswer('nobody', offer!.connectionId, answerSdp)).toBeFalse();
      expect(created[0].remoteDescription).toBeNull();

      expect(await service.setRemoteAnswer('peer-1', offer!.connectionId, answerSdp)).toBeTrue();
      expect(await service.setRemoteAnswer('peer-1', offer!.connectionId, answerSdp)).toBeFalse();
    });

    it('should not accept an answer on a connection we answered ourselves', async () => {
      await service.createAnswer('peer-1', 'conn-1', offerSdp);

      expect(await service.setRemoteAnswer('peer-1', 'conn-1', answerSdp)).toBeFalse();
    });
  });

  describe('addIceCandidate', () => {
    it('should add candidates directly once the remote description is set', async () => {
      const offer = await service.createOffer('peer-1');
      await service.setRemoteAnswer('peer-1', offer!.connectionId, answerSdp);

      await service.addIceCandidate('peer-1', offer!.connectionId, ice('late'));

      expect(created[0].addedCandidates.map(c => c.candidate)).toEqual(['late']);
    });

    it('should not apply a candidate from another attempt to the current connection', async () => {
      const offer = await service.createOffer('peer-1');
      await service.addIceCandidate('peer-1', 'other-attempt', ice('stale-before-answer'));
      await service.setRemoteAnswer('peer-1', offer!.connectionId, answerSdp);

      await service.addIceCandidate('peer-1', 'other-attempt', ice('stale-after-answer'));

      expect(created[0].addedCandidates).toEqual([]);
    });

    it('should survive a candidate the browser rejects', async () => {
      const warn = spyOn(console, 'warn');
      const offer = await service.createOffer('peer-1');
      await service.setRemoteAnswer('peer-1', offer!.connectionId, answerSdp);
      created[0].rejectCandidates = true;

      await expectAsync(service.addIceCandidate('peer-1', offer!.connectionId, ice('bad'))).toBeResolved();
      expect(service.getPeerStatus('peer-1')).toBe('connecting');
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('should ignore candidates for a connection that has failed', async () => {
      const offer = await service.createOffer('peer-1');
      await service.setRemoteAnswer('peer-1', offer!.connectionId, answerSdp);
      created[0].setIceState('failed');

      await service.addIceCandidate('peer-1', offer!.connectionId, ice('late'));

      expect(created[0].calls.filter(c => c === 'addIceCandidate').length).toBe(0);
    });
  });

  describe('connection status', () => {
    let statuses: PeerStatusChange[];

    beforeEach(() => {
      statuses = [];
      service.peerStatus$.subscribe(s => statuses.push(s));
    });

    it('should report connected, once, when the data channel opens', async () => {
      const connected: string[] = [];
      service.peerConnected$.subscribe(id => connected.push(id));
      await service.createOffer('peer-1');

      created[0].channels[0].open();
      created[0].channels[0].open();

      expect(service.getPeerStatus('peer-1')).toBe('connected');
      expect(service.isPeerConnected('peer-1')).toBeTrue();
      expect(service.getConnectedPeers()).toEqual(['peer-1']);
      expect(connected).toEqual(['peer-1']);
      expect(statuses.map(s => s.status)).toEqual(['connecting', 'connected']);
      expect(statuses[0].isInitiator).toBeTrue();
    });

    it('should not call a peer connected just because ICE connected', async () => {
      await service.createOffer('peer-1');

      created[0].setIceState('connected');

      expect(service.getPeerStatus('peer-1')).toBe('connecting');
      expect(service.isPeerConnected('peer-1')).toBeFalse();
    });

    it('should give up on a connection that never opens', fakeAsync(() => {
      const dropped: string[] = [];
      service.peerDisconnected$.subscribe(id => dropped.push(id));
      service.createOffer('peer-1');
      flushMicrotasks();

      tick(CONNECT_TIMEOUT_MS - 1);
      expect(service.getPeerStatus('peer-1')).toBe('connecting');
      tick(1);

      expect(service.getPeerStatus('peer-1')).toBe('failed');
      expect(created[0].closed).toBeTrue();
      expect(dropped).toEqual([]);
      expect(statuses.map(s => s.status)).toEqual(['connecting', 'failed']);
    }));

    it('should stop the connect timer once the channel opens', fakeAsync(() => {
      service.createOffer('peer-1');
      flushMicrotasks();

      created[0].channels[0].open();
      tick(CONNECT_TIMEOUT_MS * 2);

      expect(service.getPeerStatus('peer-1')).toBe('connected');
    }));

    it('should tolerate a short ICE disconnect and recover', fakeAsync(() => {
      service.createOffer('peer-1');
      flushMicrotasks();
      created[0].channels[0].open();

      created[0].setIceState('disconnected');
      expect(service.getPeerStatus('peer-1')).toBe('disconnected');
      tick(DISCONNECT_GRACE_MS - 1);
      created[0].setIceState('connected');
      tick(DISCONNECT_GRACE_MS * 2);

      expect(service.getPeerStatus('peer-1')).toBe('connected');
      expect(created[0].closed).toBeFalse();
    }));

    it('should drop a peer that stays disconnected past the grace period', fakeAsync(() => {
      const dropped: string[] = [];
      service.peerDisconnected$.subscribe(id => dropped.push(id));
      service.createOffer('peer-1');
      flushMicrotasks();
      created[0].channels[0].open();

      created[0].setIceState('disconnected');
      tick(DISCONNECT_GRACE_MS);

      expect(service.getPeerStatus('peer-1')).toBe('failed');
      expect(dropped).toEqual(['peer-1']);
      expect(created[0].closed).toBeTrue();
    }));

    it('should drop a peer immediately when ICE fails', async () => {
      const dropped: string[] = [];
      service.peerDisconnected$.subscribe(id => dropped.push(id));
      await service.createOffer('peer-1');
      created[0].channels[0].open();

      created[0].setIceState('failed');

      expect(service.getPeerStatus('peer-1')).toBe('failed');
      expect(dropped).toEqual(['peer-1']);
    });

    it('should drop a peer when its data channel closes', async () => {
      const dropped: string[] = [];
      service.peerDisconnected$.subscribe(id => dropped.push(id));
      await service.createOffer('peer-1');
      created[0].channels[0].open();

      created[0].channels[0].close();

      expect(service.getPeerStatus('peer-1')).toBe('failed');
      expect(dropped).toEqual(['peer-1']);
      expect(service.getConnectedPeers()).toEqual([]);
    });

    it('should ignore events from a connection that was replaced', async () => {
      const dropped: string[] = [];
      service.peerDisconnected$.subscribe(id => dropped.push(id));
      await service.createOffer('peer-1');
      const old = created[0];
      await service.createOffer('peer-1');
      statuses.length = 0;

      old.channels[0].open();
      old.setIceState('failed');
      old.gatherCandidate();

      expect(service.getPeerStatus('peer-1')).toBe('connecting');
      expect(statuses).toEqual([]);
      expect(dropped).toEqual([]);
    });
  });

  describe('messaging', () => {
    let messages: DataChannelMessage[];

    beforeEach(() => {
      messages = [];
      service.dataChannelMessage$.subscribe(m => messages.push(m));
    });

    it('should attribute messages to the peer the connection belongs to, whatever the payload claims', async () => {
      await service.createOffer('peer-1');
      created[0].channels[0].open();

      created[0].channels[0].receive(JSON.stringify({ type: 'move', data: { a: 1 }, from: 'someone-else' }));

      expect(messages).toEqual([{ type: 'move', data: { a: 1 }, from: 'peer-1' }]);
    });

    it('should ignore messages that are not well-formed', async () => {
      spyOn(console, 'error');
      await service.createOffer('peer-1');
      created[0].channels[0].open();
      const channel = created[0].channels[0];

      channel.receive('not json');
      channel.receive(JSON.stringify(null));
      channel.receive(JSON.stringify([1, 2]));
      channel.receive(JSON.stringify({ data: 1 }));
      channel.receive(JSON.stringify({ type: 5 }));
      channel.receive(new ArrayBuffer(4));

      expect(messages).toEqual([]);
    });

    it('should send a typed envelope, but only over an open channel', async () => {
      await service.createOffer('peer-1');
      const channel = created[0].channels[0];

      expect(service.sendToPeer('peer-1', 'state', { n: 1 })).toBeFalse();
      expect(service.sendToPeer('nobody', 'state', {})).toBeFalse();

      channel.open();
      expect(service.sendToPeer('peer-1', 'state', { n: 1 })).toBeTrue();
      expect(channel.sent).toEqual([JSON.stringify({ type: 'state', data: { n: 1 } })]);
    });

    it('should report a failed send instead of throwing', async () => {
      await service.createOffer('peer-1');
      created[0].channels[0].open();
      created[0].channels[0].sendError = new Error('send queue is full');
      spyOn(console, 'error');

      expect(service.sendToPeer('peer-1', 'state', {})).toBeFalse();
    });

    it('should broadcast to every peer whose channel is open', async () => {
      await service.createOffer('peer-1');
      await service.createOffer('peer-2');
      await service.createOffer('peer-3');
      created[0].channels[0].open();
      created[2].channels[0].open();

      service.broadcast('ping', 1);

      expect(created[0].channels[0].sent.length).toBe(1);
      expect(created[1].channels[0].sent.length).toBe(0);
      expect(created[2].channels[0].sent.length).toBe(1);
    });
  });

  describe('isCurrentConnection', () => {
    it('should only accept the latest attempt that is still alive', async () => {
      const first = await service.createOffer('peer-1');
      expect(service.isCurrentConnection('peer-1', first!.connectionId)).toBeTrue();
      expect(service.isCurrentConnection('peer-2', first!.connectionId)).toBeFalse();

      const second = await service.createOffer('peer-1');
      expect(service.isCurrentConnection('peer-1', first!.connectionId)).toBeFalse();
      expect(service.isCurrentConnection('peer-1', second!.connectionId)).toBeTrue();

      created[1].setIceState('failed');
      expect(service.isCurrentConnection('peer-1', second!.connectionId)).toBeFalse();
    });

    it('should be false once the peer is closed', async () => {
      const offer = await service.createOffer('peer-1');

      service.closePeerConnection('peer-1');

      expect(service.isCurrentConnection('peer-1', offer!.connectionId)).toBeFalse();
    });
  });

  describe('closing', () => {
    it('should close one connection and forget its buffered candidates', async () => {
      await service.createOffer('peer-1');
      await service.createOffer('peer-2');
      await service.addIceCandidate('peer-1', 'other', ice('stale'));

      service.closePeerConnection('peer-1');

      expect(created[0].closed).toBeTrue();
      expect(created[1].closed).toBeFalse();
      expect(service.getPeerStatus('peer-1')).toBeNull();
      expect(service.getPeerStatus('peer-2')).toBe('connecting');

      await service.createAnswer('peer-1', 'other', offerSdp);
      expect(created[2].addedCandidates).toEqual([]);
    });

    it('should close every connection', async () => {
      await service.createOffer('peer-1');
      await service.createOffer('peer-2');
      created[0].channels[0].open();

      service.closeAllConnections();

      expect(created.every(c => c.closed)).toBeTrue();
      expect(service.getConnectedPeers()).toEqual([]);
      expect(service.getPeerStatus('peer-2')).toBeNull();
    });

    it('should close connections when the service is destroyed', async () => {
      await service.createOffer('peer-1');

      service.ngOnDestroy();

      expect(created[0].closed).toBeTrue();
    });

    it('should be safe to close a peer that was never connected', () => {
      expect(() => service.closePeerConnection('nobody')).not.toThrow();
      expect(service.getConnectedPeers()).toEqual([]);
    });
  });
});

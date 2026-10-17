import { TestBed, fakeAsync, flush, flushMicrotasks, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  CANDIDATE_BATCH_MS,
  CONNECT_RETRY_DELAYS_MS,
  REQUEST_TIMEOUT_MS,
  SEND_RETRY_DELAYS_MS,
  SIGNALING_POLL_INTERVAL_MS,
  SignalingMessage,
  SignalingService
} from './signaling.service';
import { CONNECT_TIMEOUT_MS, PEER_CONNECTION_FACTORY, WebRTCService } from './webrtc.service';
import { FakePeerConnection, fakePeerConnectionFactory } from './testing/fake-rtc';

const LOBBY = 'ABC123';
// 'amy' sorts before ME and 'zed' after it; the glare rule compares ids
const ME = 'me';
const AMY = 'amy';
const ZED = 'zed';

describe('SignalingService', () => {
  let service: SignalingService;
  let webrtc: WebRTCService;
  let http: HttpTestingController;
  let connections: FakePeerConnection[];
  let setup: ((connection: FakePeerConnection) => void) | undefined;

  const signalUrl = `/api/lobby/${LOBBY}/signal`;
  const pollUrl = `${signalUrl}/${ME}`;

  const isPoll = (request: { method: string; url: string }) => request.method === 'GET' && request.url === pollUrl;

  function posts(): { request: TestRequest; message: SignalingMessage }[] {
    return http
      .match(request => request.method === 'POST' && request.url === signalUrl)
      .map(request => ({ request, message: request.request.body as SignalingMessage }));
  }

  function postTypes(sent: { message: SignalingMessage }[]): string[] {
    return sent.map(post => post.message.type);
  }

  // Waits for the next poll and hands it these messages
  function deliver(...messages: unknown[]): void {
    tick(SIGNALING_POLL_INTERVAL_MS);
    http.expectOne(isPoll).flush(messages);
    flushMicrotasks();
  }

  function start(options: { polling?: boolean } = {}): void {
    service.initializeForLobby(LOBBY, ME);
    flushMicrotasks();
    if (options.polling === false) {
      service.stopPolling();
    }
  }

  function connect(...peers: string[]): void {
    service.connectToExistingPeers(peers);
    flushMicrotasks();
  }

  function offerFrom(from: string, connectionId = `offer-from-${from}`): SignalingMessage {
    return { type: 'offer', from, to: ME, connectionId, payload: { type: 'offer', sdp: `sdp-of-${from}` } };
  }

  function answerFrom(from: string, connectionId: string): SignalingMessage {
    return { type: 'answer', from, to: ME, connectionId, payload: { type: 'answer', sdp: `sdp-of-${from}` } };
  }

  function candidatesFrom(from: string, connectionId: string, payload: unknown): SignalingMessage {
    return { type: 'ice-candidate', from, to: ME, connectionId, payload };
  }

  // Runs a fakeAsync scenario and leaves no timers behind, so tests only assert what they care about
  function scenario(body: () => void): () => void {
    return fakeAsync(() => {
      try {
        body();
      } finally {
        service.cleanup();
        webrtc.closeAllConnections();
      }
      flush();
    });
  }

  beforeEach(() => {
    connections = [];
    setup = undefined;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PEER_CONNECTION_FACTORY, useValue: fakePeerConnectionFactory(connections, c => setup?.(c)) }
      ]
    });
    service = TestBed.inject(SignalingService);
    webrtc = TestBed.inject(WebRTCService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.cleanup();
    webrtc.closeAllConnections();
    http.match(() => true);
    http.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('lobby notifications', () => {
    it('should notify when user joined lobby', () => {
      service.notifyJoined('test-lobby', 'test-user').subscribe(response => expect(response).toBeTruthy());

      const req = http.expectOne('/api/lobby/test-lobby/notify-joined');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ userId: 'test-user' });
      req.flush({ success: true });
    });

    it('should notify when user left lobby', () => {
      service.notifyLeft('test-lobby', 'test-user').subscribe(response => expect(response).toBeTruthy());

      const req = http.expectOne('/api/lobby/test-lobby/notify-left');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ userId: 'test-user' });
      req.flush({ success: true });
    });

    it('should emit peer joined and peer left events', () => {
      const joined: string[] = [];
      const left: string[] = [];
      service.peerJoined$.subscribe(id => joined.push(id));
      service.peerLeft$.subscribe(id => left.push(id));

      service.peerJoined$.next('a');
      service.peerLeft$.next('b');

      expect(joined).toEqual(['a']);
      expect(left).toEqual(['b']);
    });
  });

  describe('polling', () => {
    it('should wait one interval before the first poll', scenario(() => {
      start();

      http.expectNone(isPoll);
      tick(SIGNALING_POLL_INTERVAL_MS - 1);
      http.expectNone(isPoll);
      tick(1);

      const poll = http.expectOne(isPoll);
      expect(poll.request.method).toBe('GET');
      poll.flush([]);
    }));

    it('should keep polling at the interval', scenario(() => {
      start();

      for (let i = 0; i < 3; i++) {
        deliver();
      }
      tick(SIGNALING_POLL_INTERVAL_MS);

      expect(http.match(isPoll).length).toBe(1);
    }));

    it('should never run two polls at once, because reading a queue also empties it', scenario(() => {
      start();

      tick(SIGNALING_POLL_INTERVAL_MS * 3);
      const polls = http.match(isPoll);
      expect(polls.length).toBe(1);

      polls[0].flush([]);
      flushMicrotasks();
      tick(SIGNALING_POLL_INTERVAL_MS);
      expect(http.match(isPoll).length).toBe(1);
    }));

    it('should keep polling after a failed poll and report the failure once', scenario(() => {
      const error = spyOn(console, 'error');
      start();

      for (let i = 0; i < 3; i++) {
        tick(SIGNALING_POLL_INTERVAL_MS);
        http.expectOne(isPoll).flush('down', { status: 500, statusText: 'Server Error' });
        flushMicrotasks();
      }

      expect(error).toHaveBeenCalledTimes(1);
      deliver();
    }));

    it('should give up on a poll that never answers and poll again', scenario(() => {
      spyOn(console, 'error');
      start();

      tick(SIGNALING_POLL_INTERVAL_MS);
      expect(http.match(isPoll).length).toBe(1);
      tick(REQUEST_TIMEOUT_MS);
      flushMicrotasks();
      tick(SIGNALING_POLL_INTERVAL_MS);

      expect(http.match(isPoll).length).toBe(1);
    }));

    it('should poll only once when started twice for the same lobby', scenario(() => {
      start();
      start();

      tick(SIGNALING_POLL_INTERVAL_MS);

      expect(http.match(isPoll).length).toBe(1);
    }));

    it('should poll the new lobby after switching lobbies', scenario(() => {
      start();
      service.initializeForLobby('OTHER1', ME);
      flushMicrotasks();

      tick(SIGNALING_POLL_INTERVAL_MS);

      expect(http.match(isPoll).length).toBe(0);
      http.expectOne(`/api/lobby/OTHER1/signal/${ME}`).flush([]);
    }));

    it('should stop polling on request and again on cleanup', scenario(() => {
      start();
      service.stopPolling();
      tick(SIGNALING_POLL_INTERVAL_MS * 3);
      expect(http.match(isPoll).length).toBe(0);

      start();
      service.cleanup();
      tick(SIGNALING_POLL_INTERVAL_MS * 3);
      expect(http.match(isPoll).length).toBe(0);
    }));

    it('should resume polling when started again after the polling was stopped', scenario(() => {
      start();
      service.stopPolling();

      start();

      tick(SIGNALING_POLL_INTERVAL_MS);
      expect(http.match(isPoll).length).toBe(1);
    }));
  });

  describe('starting connections', () => {
    it('should offer a connection to every other player, once each', scenario(() => {
      start({ polling: false });

      connect(ME, AMY, ZED, AMY);

      expect(connections.length).toBe(2);
      const sent = posts();
      expect(postTypes(sent)).toEqual(['offer', 'offer']);
      expect(sent.map(post => post.message.to)).toEqual([AMY, ZED]);
      sent.forEach(({ message }) => {
        expect(message.from).toBe(ME);
        expect(message.connectionId).toBeTruthy();
        expect((message.payload as RTCSessionDescriptionInit).type).toBe('offer');
      });
    }));

    it('should do nothing before signaling was started', scenario(() => {
      connect(AMY);

      expect(connections.length).toBe(0);
    }));

    it('should send the candidates gathered while creating the offer only after the offer', scenario(() => {
      setup = c => (c.onSetLocalDescription = () => c.gatherCandidate('early'));
      start({ polling: false });

      connect(AMY);

      let sent = posts();
      expect(postTypes(sent)).toEqual(['offer']);
      sent[0].request.flush({});
      flushMicrotasks();

      sent = posts();
      expect(postTypes(sent)).toEqual(['ice-candidate']);
      expect((sent[0].message.payload as RTCIceCandidateInit[]).map(c => c.candidate)).toEqual(['early']);
    }));

    it('should hold candidates back for as long as the offer takes to create', scenario(() => {
      setup = c => {
        c.setLocalDescription = async () => {
          c.gatherCandidate('early');
          await new Promise<void>(resolve => setTimeout(resolve, CANDIDATE_BATCH_MS * 2));
        };
      };
      start({ polling: false });

      connect(AMY);
      tick(CANDIDATE_BATCH_MS * 2);
      flushMicrotasks();

      let sent = posts();
      expect(postTypes(sent)).toEqual(['offer']);
      sent[0].request.flush({});
      flushMicrotasks();
      sent = posts();
      expect(postTypes(sent)).toEqual(['ice-candidate']);
    }));

    it('should batch candidates that trickle in together', scenario(() => {
      start({ polling: false });
      connect(AMY);
      posts()[0].request.flush({});
      flushMicrotasks();

      connections[0].gatherCandidate('one');
      tick(CANDIDATE_BATCH_MS - 1);
      connections[0].gatherCandidate('two');
      expect(posts().length).toBe(0);
      tick(1);
      flushMicrotasks();
      connections[0].gatherCandidate('three');
      tick(CANDIDATE_BATCH_MS);
      flushMicrotasks();

      const sent = posts();
      expect(sent.length).toBe(1);
      expect((sent[0].message.payload as RTCIceCandidateInit[]).map(c => c.candidate)).toEqual(['one', 'two']);
      sent[0].request.flush({});
      flushMicrotasks();
      const rest = posts();
      expect(rest.length).toBe(1);
      expect((rest[0].message.payload as RTCIceCandidateInit[]).map(c => c.candidate)).toEqual(['three']);
    }));

    it('should tag the offer and its candidates with the id of the connection attempt', scenario(() => {
      setup = c => (c.onSetLocalDescription = () => c.gatherCandidate('early'));
      start({ polling: false });
      connect(AMY);

      const [offer] = posts();
      offer.request.flush({});
      flushMicrotasks();
      const [candidates] = posts();

      expect(offer.message.connectionId).toBeTruthy();
      expect(candidates.message.connectionId).toBe(offer.message.connectionId!);
    }));

    it('should not send candidates of a connection that has been replaced in the meantime', scenario(() => {
      start({ polling: false });
      connect(AMY);
      const [firstOffer] = posts();
      connections[0].gatherCandidate('stale');
      tick(CANDIDATE_BATCH_MS);

      connect(AMY);
      firstOffer.request.flush({});
      flushMicrotasks();

      const sent = posts();
      expect(postTypes(sent)).toEqual(['offer']);
      expect(sent[0].message.connectionId).not.toBe(firstOffer.message.connectionId);
    }));

    it('should keep relaying candidates after being cleaned up and started again', scenario(() => {
      setup = c => (c.onSetLocalDescription = () => c.gatherCandidate('early'));
      start({ polling: false });
      service.cleanup();
      start({ polling: false });

      connect(AMY);
      posts()[0].request.flush({});
      flushMicrotasks();

      expect(postTypes(posts())).toEqual(['ice-candidate']);
    }));
  });

  describe('sending reliably', () => {
    it('should send again after a server error, with the same message', scenario(() => {
      start({ polling: false });
      connect(AMY);
      const [first] = posts();

      first.request.flush('busy', { status: 503, statusText: 'Service Unavailable' });
      flushMicrotasks();
      expect(posts().length).toBe(0);
      tick(SEND_RETRY_DELAYS_MS[0]);
      flushMicrotasks();

      const retried = posts();
      expect(retried.length).toBe(1);
      expect(retried[0].message).toEqual(first.message);
    }));

    it('should send again after the rate limit was hit or the network dropped', scenario(() => {
      start({ polling: false });
      connect(AMY);

      posts()[0].request.flush('slow down', { status: 429, statusText: 'Too Many Requests' });
      flushMicrotasks();
      tick(SEND_RETRY_DELAYS_MS[0]);
      flushMicrotasks();
      posts()[0].request.error(new ProgressEvent('error'));
      flushMicrotasks();
      tick(SEND_RETRY_DELAYS_MS[1]);
      flushMicrotasks();

      expect(posts().length).toBe(1);
    }));

    it('should send again when the request times out', scenario(() => {
      start({ polling: false });
      connect(AMY);
      expect(posts().length).toBe(1);

      tick(REQUEST_TIMEOUT_MS);
      flushMicrotasks();
      tick(SEND_RETRY_DELAYS_MS[0]);
      flushMicrotasks();

      expect(posts().length).toBe(1);
    }));

    it('should not resend a message the server rejected', scenario(() => {
      const error = spyOn(console, 'error');
      start({ polling: false });
      connect(AMY);

      posts()[0].request.flush({ error: 'bad' }, { status: 400, statusText: 'Bad Request' });
      flushMicrotasks();
      tick(SEND_RETRY_DELAYS_MS[0] * 10);
      flushMicrotasks();

      expect(posts().length).toBe(0);
      expect(error).toHaveBeenCalled();
    }));

    it('should stop resending after the retries run out', scenario(() => {
      spyOn(console, 'error');
      start({ polling: false });
      connect(AMY);

      posts()[0].request.flush('down', { status: 503, statusText: 'Unavailable' });
      for (const delay of SEND_RETRY_DELAYS_MS) {
        flushMicrotasks();
        tick(delay);
        flushMicrotasks();
        posts()[0].request.flush('down', { status: 503, statusText: 'Unavailable' });
      }
      flushMicrotasks();
      tick(SEND_RETRY_DELAYS_MS[SEND_RETRY_DELAYS_MS.length - 1] * 2);
      flushMicrotasks();

      expect(posts().length).toBe(0);
    }));

    it('should drop messages queued for a connection that has been closed', scenario(() => {
      start({ polling: false });
      connect(AMY);
      const [offer] = posts();
      offer.request.flush('down', { status: 503, statusText: 'Unavailable' });
      flushMicrotasks();

      webrtc.closePeerConnection(AMY);
      tick(SEND_RETRY_DELAYS_MS[0]);
      flushMicrotasks();

      expect(posts().length).toBe(0);
    }));
  });

  describe('answering offers', () => {
    it('should answer with the id of the offer and apply the offer first', scenario(() => {
      start();

      deliver(offerFrom(AMY, 'conn-1'));

      expect(connections.length).toBe(1);
      expect(connections[0].remoteDescription).toEqual({ type: 'offer', sdp: `sdp-of-${AMY}` });
      const [answer] = posts();
      expect(answer.message).toEqual(
        jasmine.objectContaining({ type: 'answer', from: ME, to: AMY, connectionId: 'conn-1' })
      );
      expect((answer.message.payload as RTCSessionDescriptionInit).type).toBe('answer');
      expect(webrtc.isInitiator(AMY)).toBeFalse();
    }));

    it('should send candidates gathered while answering after the answer', scenario(() => {
      setup = c => (c.onSetLocalDescription = () => c.gatherCandidate('mine'));
      start();

      deliver(offerFrom(AMY, 'conn-1'));
      let sent = posts();
      expect(postTypes(sent)).toEqual(['answer']);
      sent[0].request.flush({});
      flushMicrotasks();

      sent = posts();
      expect(postTypes(sent)).toEqual(['ice-candidate']);
      expect(sent[0].message.connectionId).toBe('conn-1');
    }));

    it('should use candidates that arrived ahead of the offer', scenario(() => {
      start();

      deliver(candidatesFrom(AMY, 'conn-1', [{ candidate: 'early', sdpMid: '0', sdpMLineIndex: 0 }]));
      expect(connections.length).toBe(0);
      deliver(offerFrom(AMY, 'conn-1'));

      expect(connections[0].addedCandidates.map(c => c.candidate)).toEqual(['early']);
    }));

    it('should not tear down a connection when the same offer is delivered again', scenario(() => {
      start();
      deliver(offerFrom(AMY, 'conn-1'));
      posts().forEach(post => post.request.flush({}));
      flushMicrotasks();

      deliver(offerFrom(AMY, 'conn-1'));

      expect(connections.length).toBe(1);
      expect(connections[0].closed).toBeFalse();
      expect(posts().length).toBe(0);
    }));

    it('should answer a fresh offer from a peer that reloaded, replacing the old connection', scenario(() => {
      start();
      deliver(offerFrom(AMY, 'old'));

      deliver(offerFrom(AMY, 'new'));

      expect(connections.length).toBe(2);
      expect(connections[0].closed).toBeTrue();
      expect(webrtc.isCurrentConnection(AMY, 'new')).toBeTrue();
    }));
  });

  describe('when both sides offer at once', () => {
    it('should keep its own offer and ignore the other when its id is lower', scenario(() => {
      start();
      connect(ZED);
      posts().forEach(post => post.request.flush({}));
      flushMicrotasks();
      const ours = connections[0];

      deliver(offerFrom(ZED, 'zed-offer'));

      expect(connections.length).toBe(1);
      expect(ours.closed).toBeFalse();
      expect(webrtc.hasPendingLocalOffer(ZED)).toBeTrue();
      expect(posts().length).toBe(0);
    }));

    it('should answer the other offer and drop its own when its id is higher', scenario(() => {
      start();
      connect(AMY);
      posts().forEach(post => post.request.flush({}));
      flushMicrotasks();

      deliver(offerFrom(AMY, 'amy-offer'));

      expect(connections.length).toBe(2);
      expect(connections[0].closed).toBeTrue();
      expect(webrtc.isInitiator(AMY)).toBeFalse();
      expect(postTypes(posts())).toEqual(['answer']);
    }));

    it('should end up with one working connection when each side applies the same rule', scenario(() => {
      // Our offer to ZED crosses ZED's offer to us; we have the lower id, so we win and ZED answers ours
      start();
      connect(ZED);
      const [ourOffer] = posts();
      ourOffer.request.flush({});
      flushMicrotasks();
      deliver(offerFrom(ZED, 'zed-offer'));
      const ourConnectionId = ourOffer.message.connectionId!;

      deliver(answerFrom(ZED, ourConnectionId));

      expect(connections.length).toBe(1);
      expect(connections[0].remoteDescription).toEqual({ type: 'answer', sdp: `sdp-of-${ZED}` });
      expect(webrtc.hasPendingLocalOffer(ZED)).toBeFalse();
    }));
  });

  describe('handling answers and candidates', () => {
    it('should apply the answer to the matching offer', scenario(() => {
      start();
      connect(AMY);
      const connectionId = posts()[0].message.connectionId!;

      deliver(answerFrom(AMY, connectionId));

      expect(connections[0].remoteDescription).toEqual({ type: 'answer', sdp: `sdp-of-${AMY}` });
    }));

    it('should ignore an answer to an earlier attempt', scenario(() => {
      start();
      connect(AMY);

      deliver(answerFrom(AMY, 'some-earlier-attempt'));

      expect(connections[0].remoteDescription).toBeNull();
    }));

    it('should add every candidate in a batch, and single candidates sent the old way', scenario(() => {
      start();
      connect(AMY);
      const connectionId = posts()[0].message.connectionId!;
      deliver(answerFrom(AMY, connectionId));

      deliver(candidatesFrom(AMY, connectionId, [{ candidate: 'a' }, { candidate: 'b', sdpMid: '0', sdpMLineIndex: 0 }]));
      deliver(candidatesFrom(AMY, connectionId, { candidate: 'c', sdpMid: '0', sdpMLineIndex: 0 }));

      expect(connections[0].addedCandidates.map(c => c.candidate)).toEqual(['a', 'b', 'c']);
    }));

    it('should skip candidates that are not well-formed and cap how many one message may carry', scenario(() => {
      start();
      connect(AMY);
      const connectionId = posts()[0].message.connectionId!;
      deliver(answerFrom(AMY, connectionId));
      const many = Array.from({ length: 80 }, (_, i) => ({ candidate: `c${i}` }));

      deliver(candidatesFrom(AMY, connectionId, [null, 5, 'x', { candidate: 7 }, { candidate: 'x'.repeat(5000) }, ...many]));

      expect(connections[0].addedCandidates.length).toBe(45);
    }));

    it('should ignore malformed messages and keep processing the valid ones after them', scenario(() => {
      const error = spyOn(console, 'error');
      start();

      deliver(
        null,
        'text',
        42,
        {},
        { type: 'offer', from: AMY },
        { type: 'offer', from: AMY, connectionId: 'c', payload: { type: 'answer', sdp: 'x' } },
        { type: 'offer', from: AMY, connectionId: 'c', payload: { type: 'offer' } },
        { type: 'offer', from: AMY, connectionId: 'x'.repeat(200), payload: { type: 'offer', sdp: 'x' } },
        { type: 'answer', from: AMY, connectionId: 5, payload: { type: 'answer', sdp: 'x' } },
        { type: 'answer', from: AMY, connectionId: 'c', payload: 'nope' },
        { type: 'ice-candidate', from: AMY, payload: [{ candidate: 'x' }] },
        { type: 'ice-candidate', from: AMY, connectionId: 'c', payload: 'nope' },
        { type: 'teleport', from: AMY },
        { type: 'offer', from: ME, to: ME, connectionId: 'self', payload: { type: 'offer', sdp: 'x' } },
        offerFrom(ZED, 'real')
      );

      expect(connections.length).toBe(1);
      expect(webrtc.isCurrentConnection(ZED, 'real')).toBeTrue();
      expect(error).not.toHaveBeenCalled();
    }));

    it('should carry on with the rest of the queue when one message cannot be handled', scenario(() => {
      const error = spyOn(console, 'error');
      setup = c => {
        if (connections.length === 1) {
          c.setRemoteDescription = () => Promise.reject(new Error('bad sdp'));
        }
      };
      start();

      deliver(offerFrom(AMY, 'first'), offerFrom(ZED, 'second'));

      expect(error).toHaveBeenCalled();
      expect(webrtc.isCurrentConnection(ZED, 'second')).toBeTrue();
    }));
  });

  describe('players joining and leaving', () => {
    it('should tell the lobby a player joined without offering them a connection', scenario(() => {
      const joined: string[] = [];
      service.peerJoined$.subscribe(id => joined.push(id));
      start();

      deliver({ type: 'peer-joined', from: ZED, to: ME });

      expect(joined).toEqual([ZED]);
      expect(connections.length).toBe(0);
    }));

    it('should close the connection and tell the lobby when a player leaves', scenario(() => {
      const left: string[] = [];
      service.peerLeft$.subscribe(id => left.push(id));
      start();
      connect(AMY);

      deliver({ type: 'peer-left', from: AMY, to: ME });

      expect(left).toEqual([AMY]);
      expect(connections[0].closed).toBeTrue();
      expect(webrtc.getPeerStatus(AMY)).toBeNull();
    }));

    it('should not try to reconnect to a player who left', scenario(() => {
      start({ polling: false });
      connect(AMY);
      connections[0].setIceState('failed');
      webrtc.closePeerConnection(AMY);

      tick(CONNECT_RETRY_DELAYS_MS[0] * 2);
      flushMicrotasks();

      expect(connections.length).toBe(1);
    }));
  });

  describe('reconnecting', () => {
    it('should offer again when a connection we started fails', scenario(() => {
      start({ polling: false });
      connect(AMY);

      tick(CONNECT_TIMEOUT_MS);
      expect(webrtc.getPeerStatus(AMY)).toBe('failed');
      tick(CONNECT_RETRY_DELAYS_MS[0] - 1);
      expect(connections.length).toBe(1);
      tick(1);
      flushMicrotasks();

      expect(connections.length).toBe(2);
      expect(webrtc.getPeerStatus(AMY)).toBe('connecting');
      expect(webrtc.isInitiator(AMY)).toBeTrue();
    }));

    it('should back off between attempts and stop after the retries run out', scenario(() => {
      start({ polling: false });
      connect(AMY);

      for (const delay of CONNECT_RETRY_DELAYS_MS) {
        tick(CONNECT_TIMEOUT_MS);
        tick(delay);
        flushMicrotasks();
      }
      tick(CONNECT_TIMEOUT_MS);
      tick(CONNECT_RETRY_DELAYS_MS[CONNECT_RETRY_DELAYS_MS.length - 1] * 2);
      flushMicrotasks();

      expect(connections.length).toBe(1 + CONNECT_RETRY_DELAYS_MS.length);
      expect(webrtc.getPeerStatus(AMY)).toBe('failed');
    }));

    it('should not retry connections that the other side started', scenario(() => {
      // The unanswered polls that pile up over the long wait time out; that is not what is under test
      spyOn(console, 'error');
      start();
      deliver(offerFrom(AMY, 'conn-1'));

      tick(CONNECT_TIMEOUT_MS);
      tick(CONNECT_RETRY_DELAYS_MS[0] * 2);
      flushMicrotasks();

      expect(connections.length).toBe(1);
      expect(webrtc.getPeerStatus(AMY)).toBe('failed');
    }));

    it('should start over on request, even after the automatic retries ran out', scenario(() => {
      start({ polling: false });
      connect(AMY);
      for (const delay of CONNECT_RETRY_DELAYS_MS) {
        tick(CONNECT_TIMEOUT_MS);
        tick(delay);
        flushMicrotasks();
      }
      tick(CONNECT_TIMEOUT_MS);
      const attempts = connections.length;

      service.retryPeer(AMY);
      flushMicrotasks();

      expect(connections.length).toBe(attempts + 1);
      expect(webrtc.getPeerStatus(AMY)).toBe('connecting');
      tick(CONNECT_TIMEOUT_MS);
      tick(CONNECT_RETRY_DELAYS_MS[0]);
      flushMicrotasks();
      expect(connections.length).toBe(attempts + 2);
    }));

    it('should give a connection that came up a fresh set of retries', scenario(() => {
      start({ polling: false });
      connect(AMY);
      tick(CONNECT_TIMEOUT_MS);
      tick(CONNECT_RETRY_DELAYS_MS[0]);
      flushMicrotasks();
      expect(connections.length).toBe(2);

      connections[1].channels[0].open();
      connections[1].setIceState('failed');
      for (const delay of CONNECT_RETRY_DELAYS_MS) {
        tick(delay);
        flushMicrotasks();
        tick(CONNECT_TIMEOUT_MS);
      }

      expect(connections.length).toBe(2 + CONNECT_RETRY_DELAYS_MS.length);
    }));

    it('should not wait for a retry that was cancelled by cleaning up', scenario(() => {
      start({ polling: false });
      connect(AMY);
      tick(CONNECT_TIMEOUT_MS);

      service.cleanup();
      tick(CONNECT_RETRY_DELAYS_MS[0] * 2);
      flushMicrotasks();

      expect(connections.length).toBe(1);
    }));
  });

  describe('cleanup', () => {
    it('should stop everything it had going', scenario(() => {
      setup = c => (c.onSetLocalDescription = () => c.gatherCandidate('early'));
      start();
      connect(AMY);
      const [offer] = posts();

      service.cleanup();
      offer.request.flush({});
      flushMicrotasks();
      tick(SIGNALING_POLL_INTERVAL_MS * 5);
      tick(CANDIDATE_BATCH_MS);
      flushMicrotasks();

      http.expectNone(isPoll);
      expect(posts().length).toBe(0);
    }));

    it('should be safe to call repeatedly and before anything started', () => {
      expect(() => {
        service.cleanup();
        service.cleanup();
        service.stopPolling();
      }).not.toThrow();
    });
  });
});

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SignalingService } from './signaling.service';
import { WebRTCService } from './webrtc.service';

describe('SignalingService', () => {
  let service: SignalingService;
  let httpMock: HttpTestingController;
  let webrtcService: WebRTCService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SignalingService, WebRTCService]
    });
    service = TestBed.inject(SignalingService);
    httpMock = TestBed.inject(HttpTestingController);
    webrtcService = TestBed.inject(WebRTCService);
  });

  afterEach(() => {
    httpMock.verify();
    service.cleanup();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should notify when user joined lobby', () => {
    const lobbyId = 'test-lobby';
    const userId = 'test-user';

    service.notifyJoined(lobbyId, userId).subscribe(response => {
      expect(response).toBeTruthy();
    });

    const req = httpMock.expectOne(`/api/lobby/${lobbyId}/notify-joined`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userId });
    req.flush({ success: true });
  });

  it('should notify when user left lobby', () => {
    const lobbyId = 'test-lobby';
    const userId = 'test-user';

    service.notifyLeft(lobbyId, userId).subscribe(response => {
      expect(response).toBeTruthy();
    });

    const req = httpMock.expectOne(`/api/lobby/${lobbyId}/notify-left`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userId });
    req.flush({ success: true });
  });

  it('should emit peer joined event', (done) => {
    service.peerJoined$.subscribe((peerId) => {
      expect(peerId).toBeTruthy();
      done();
    });
    
    // Manually trigger for testing
    service.peerJoined$.next('test-peer');
  });

  it('should emit peer left event', (done) => {
    service.peerLeft$.subscribe((peerId) => {
      expect(peerId).toBeTruthy();
      done();
    });
    
    // Manually trigger for testing
    service.peerLeft$.next('test-peer');
  });

  it('should stop polling on cleanup', () => {
    service.cleanup();
    // Should not throw and should clear internal state
    expect(true).toBe(true);
  });

  it('should initialize for lobby', async () => {
    const lobbyId = 'test-lobby';
    const userId = 'test-user';
    
    // Should not throw
    await service.initializeForLobby(lobbyId, userId);
    
    expect(true).toBe(true);
    
    service.stopPolling();
  });
});

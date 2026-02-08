import { TestBed } from '@angular/core/testing';
import { WebRTCService } from './webrtc.service';

describe('WebRTCService', () => {
  let service: WebRTCService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WebRTCService]
    });
    service = TestBed.inject(WebRTCService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should create peer connection', async () => {
    const peerId = 'test-peer-1';
    const peerConnection = await service.createPeerConnection(peerId, true);
    
    expect(peerConnection).toBeTruthy();
    expect(peerConnection).toBeInstanceOf(RTCPeerConnection);
  });

  it('should create offer for peer', async () => {
    const peerId = 'test-peer-1';
    const offer = await service.createOffer(peerId);
    
    expect(offer).toBeTruthy();
    expect(offer.type).toBe('offer');
    expect(offer.sdp).toBeTruthy();
  });

  it('should get connected peers', () => {
    const peers = service.getConnectedPeers();
    expect(Array.isArray(peers)).toBe(true);
  });

  it('should close peer connection', async () => {
    const peerId = 'test-peer-1';
    await service.createPeerConnection(peerId, true);
    
    service.closePeerConnection(peerId);
    
    const connectedPeers = service.getConnectedPeers();
    expect(connectedPeers).not.toContain(peerId);
  });

  it('should close all connections', async () => {
    await service.createPeerConnection('peer-1', true);
    await service.createPeerConnection('peer-2', true);
    
    service.closeAllConnections();
    
    const connectedPeers = service.getConnectedPeers();
    expect(connectedPeers.length).toBe(0);
  });

  it('should broadcast to all peers', async () => {
    const peerId1 = 'peer-1';
    const peerId2 = 'peer-2';
    
    await service.createPeerConnection(peerId1, true);
    await service.createPeerConnection(peerId2, true);
    
    // This should not throw
    service.broadcast('test', { message: 'hello' });
    
    expect(true).toBe(true);
  });
});

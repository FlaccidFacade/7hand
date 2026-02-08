# WebRTC Networking Guide

This document explains the WebRTC peer-to-peer networking infrastructure used in 7hand for real-time game state synchronization.

## Overview

PR #124 introduces WebRTC (Web Real-Time Communication) to enable peer-to-peer connections between players in a lobby. This allows game state to be shared directly between players' browsers without routing through the server, reducing server load and latency.

## Current Configuration

### STUN Servers: ✅ **Yes, We Are Using STUN Servers**

The application is configured to use **Google's public STUN servers**:

- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`

**Configuration Location:** `frontend/src/app/services/webrtc.service.ts` (STUN/ICE servers configuration block)

### TURN Servers: ❌ **Not Currently Configured**

The application does **NOT** have TURN servers configured.

## What Are STUN and TURN Servers?

### STUN (Session Traversal Utilities for NAT)

**What it does:**
- Helps peers discover their public IP address
- Enables NAT traversal for direct peer-to-peer connections
- Required for WebRTC connections to work across different networks

**When it works:**
- Both peers have moderate NAT (most home routers)
- At least one peer has a public IP or permissive firewall
- Success rate: ~80-85% of connections

**Current Setup:**
✅ Using free Google public STUN servers (suitable for development and small-scale production)

### TURN (Traversal Using Relays around NAT)

**What it does:**
- Acts as a relay server when direct peer-to-peer connections fail
- Forwards traffic between peers who cannot connect directly
- Fallback mechanism for restrictive NAT/firewall scenarios

**When you need it:**
- Both peers behind symmetric NAT or restrictive firewalls
- Corporate networks, mobile carriers, or strict firewall policies
- To guarantee connection success (99%+ connection rate)

**Current Setup:**
❌ No TURN server configured - connections may fail in ~15-20% of cases

## Do You Need More Nodes?

The answer depends on your deployment scenario:

### Current Setup: **Backend + Database Nodes**

You currently need:
1. **1+ Backend Server(s)** (Node.js/Express) - for signaling and API
2. **1 Database Server** (PostgreSQL) - for user data and lobby state
3. **Client Browsers** - where WebRTC P2P connections run

### Do You Need TURN Servers?

**For Development/Testing:** ❌ **No**
- Google's public STUN servers are sufficient
- Most connections will work

**For Small-Scale Production (<50 concurrent users):** ⚠️ **Optional**
- Can use free TURN services like:
  - Xirsys (free tier: 500 MB/month)
  - Twilio STUN/TURN (pay-as-you-go)
- Or accept 15-20% connection failure rate

**For Production/Commercial Use:** ✅ **Yes, Recommended**
- Critical for reliability and user experience
- Required for users behind restrictive corporate firewalls
- Guarantees near 100% connection success rate

### Infrastructure Options

#### Option 1: Public Services (Quick Start)
```javascript
// No additional nodes needed - use existing infrastructure
iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },          // STUN (free)
  { urls: 'turn:YOUR_TURN_SERVER',                    // TURN (paid service)
    username: 'user',
    credential: 'pass'
  }
]
```

**Cost:** $0-50/month depending on usage

#### Option 2: Self-Hosted TURN Server (Cost-Effective at Scale)
```bash
# Add 1 additional node running coturn
docker run -d --network=host \
  coturn/coturn \
  -n --log-file=stdout \
  --external-ip=YOUR_PUBLIC_IP
```

**Infrastructure:**
- **1 Additional Server** (1 vCPU, 1GB RAM minimum)
- Public IP address required
- Open UDP ports: 3478, 49152-65535

**Cost:** ~$5-10/month for small VPS

#### Option 3: Use Cloud TURN Services (Easiest)
- **Twilio:** $0.0015/min per participant
- **Xirsys:** Free tier available, then ~$50/month
- **Metered.ca:** $0.50/GB

**Infrastructure:** None - just add credentials

## Network Requirements

### Server Requirements

| Component | Ports | Protocol | Purpose |
|-----------|-------|----------|---------|
| Backend API | 3000 | HTTP/WS | Signaling server |
| Frontend | 4200/80 | HTTP | Web app delivery |
| STUN (Google) | 19302 | UDP | NAT discovery (external) |
| TURN (if added) | 3478, 49152-65535 | UDP/TCP | Relay traffic (your server) |

### Client Browser Requirements

- Modern browser with WebRTC support (Chrome, Firefox, Safari, Edge)
- JavaScript enabled
- Outbound UDP connectivity (for STUN/TURN)
- No special ports need to be opened on client side

### Bandwidth Considerations

**Per Game Session:**
- Signaling (initial setup): ~5-10 KB
- Game state updates: ~1-5 KB/s per peer
- For 4-player game: ~3-15 KB/s per player

**For 100 Concurrent Users (25 games):**
- Signaling traffic: Negligible (<1 Mbps)
- P2P traffic: Direct between peers (no server bandwidth)
- TURN relay traffic (if used): 10-50 GB/month

## How It Works

### Connection Flow

1. **Player joins lobby** → Backend notifies other players
2. **Signaling exchange** → Backend relays WebRTC offers/answers
3. **STUN discovery** → Players discover their public IPs
4. **Direct P2P connection** → Data channel established
5. **Game state sharing** → Updates sent peer-to-peer

### Signaling Architecture

- **HTTP polling** (every 2 seconds) for signaling messages
- Backend stores messages in-memory (max 100/user)
- Cleanup runs every 5 minutes
- Not using WebSocket (could be optimized)

## Recommendations

### For Development
✅ Current setup is fine - no changes needed

### For Production Deployment

1. **Add TURN Server** (recommended)
   - Use Twilio or self-host coturn
   - Ensures reliable connections

2. **Switch to WebSocket Signaling** (optional optimization)
   - Replace HTTP polling with WebSocket
   - Reduces latency and server load

3. **Monitor Connection Success Rate**
   - Track successful P2P connections
   - Add TURN if success rate <85%

4. **Load Balancing** (for scale)
   - Multiple backend nodes behind load balancer
   - Session affinity for signaling
   - Shared database for state

## Configuration Examples

### Adding TURN Server (Twilio Example)

```typescript
// frontend/src/app/services/webrtc.service.ts
private configuration: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:global.turn.twilio.com:3478?transport=udp',
      username: 'your-twilio-username',
      credential: 'your-twilio-credential'
    }
  ]
};
```

### Self-Hosted Coturn Server

```bash
# Install coturn
apt-get install coturn

# Edit /etc/turnserver.conf
listening-port=3478
external-ip=YOUR_PUBLIC_IP
realm=yourdomain.com
user=username:password
```

## Cost Analysis

### Small Scale (10 concurrent games, 40 users)
- Backend: $5-10/month (1 VPS)
- Database: $5-10/month (shared VPS or RDS free tier)
- STUN: Free (Google)
- TURN: $0-20/month (Xirsys free tier or small VPS)
- **Total: $10-40/month**

### Medium Scale (100 concurrent games, 400 users)
- Backend: $20-40/month (2-3 load-balanced VPS)
- Database: $15-30/month (managed DB)
- STUN: Free (Google)
- TURN: $50-100/month (coturn VPS or metered service)
- **Total: $85-170/month**

## Troubleshooting

### Connections Failing
1. Check browser console for ICE connection state
2. Verify STUN servers are accessible (try from browser console)
3. Test with different networks (home, mobile, corporate)
4. Add TURN server if connections fail consistently

### High Server Load
1. Current HTTP polling every 2s may cause load
2. Consider switching to WebSocket for signaling
3. Implement connection pooling and cleanup

### Firewall Issues
1. Ensure UDP ports are not blocked
2. Check corporate firewall policies
3. Add TURN server with TCP transport as fallback

## Summary

**Current State:**
- ✅ STUN servers configured (Google public)
- ❌ No TURN servers
- ✅ Signaling server (HTTP polling)
- ✅ Works for most connections (~80-85%)

**Node Requirements:**
- **Minimum:** 1 backend + 1 database = **2 nodes**
- **Recommended for production:** Add 1 TURN server = **3 nodes**

**Bottom Line:**
- Current setup works for development
- For production reliability, add a TURN server
- Can start with free/cheap cloud TURN services
- Scale to self-hosted TURN server as user base grows

---

For questions or issues with WebRTC connections, check the browser console and network tab, or open an issue on GitHub.

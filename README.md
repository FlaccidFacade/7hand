# 7hand

is a rummy variation for all ages. featuring 7 hands to play each game!

## Getting Started with Development

ensure you have [docker compose](https://docs.docker.com/compose/)  in a shell environment. preferably vscode w/ devcontainers extension installed.

## Card Game Monorepo

This project contains both the frontend (Angular) and backend for a multiplayer card game.

### Project Structure

- `frontend/` – Angular app (served on port 4200 in dev, port 80 in prod)
- `backend/` – Express API (served on port 3000) [Legacy]
- `nginx-proxy/` – Nginx reverse proxy for production EC2 deployments (port 8000)
- `docker-compose.yml` – Orchestrates both services

### WebRTC Peer-to-Peer Networking

7hand uses WebRTC for real-time peer-to-peer game state synchronization between players. This reduces server load and latency by allowing players to communicate directly.

📖 **See [WEBRTC_NETWORKING.md](WEBRTC_NETWORKING.md) for detailed information about:**
- STUN and TURN server configuration
- Network infrastructure requirements
- Whether you need additional nodes for production
- Cost analysis and deployment recommendations

### Quick Start (with Docker Compose)

1. Build and start 3 main services:

   ```bash
   docker compose up frontend-dev backend db
   ```

2. Code in the container via `code frontend`. Select 'Reopen in Container' and Access the frontend at: <http://localhost:4200>
3. The backend API is available at: <http://localhost:3000>

### Development

- Code changes in `frontend/` or `backend/` will be reflected in the running containers (volumes are mounted).
- Stop the stack with `Ctrl+C` and remove containers with:

   ```bash
   docker-compose down
   ```

### Production Deployment

For production EC2 deployments, use the nginx reverse proxy:

1. Start the production stack with proxy:

   ```bash
   docker compose up sevenhand-proxy frontend backend db
   ```

2. Access the application through the proxy at: <http://localhost:8000>
3. Health check endpoint for load balancers: <http://localhost:8000/health>

The proxy provides:
- Unified entry point for frontend and backend
- Rate limiting and security features
- WebSocket support for real-time game features
- Optimized for AWS EC2 deployment

### Raspberry Pi Hosting Notes

The stack has now been hosted successfully on a Raspberry Pi arm64 system using Docker Compose and the repo-root setup script:

```bash
sudo python3 7handsetup.py os
sudo python3 7handsetup.py docker
sudo python3 7handsetup.py app
sudo python3 7handsetup.py start
sudo python3 7handsetup.py verify
```

Lessons learned from the live Pi deployment:

- Use the repo-root `7handsetup.py` script for host provisioning and re-deploys. It includes the fixes required for unattended apt operations and Docker installation on Debian-based Pi OS.
- `apt-get full-upgrade` can block on `apt-listchanges` during first bootstrapping. The setup script now forces non-interactive apt behavior so provisioning does not hang.
- The script must be run with `sudo` or as root. Earlier root-check logic was incorrect; the current script uses `os.geteuid()` and should be treated as the canonical version.
- The Docker GPG key install path matters on newer Debian/Pi OS builds. The current script writes Docker's key into `/etc/apt/keyrings/docker.gpg` and configures the apt source explicitly for `arm64`.
- Angular 22 on this repo required a newer Node image than the original frontend Dockerfile used. Production builds now rely on Node 24 in the frontend Dockerfile.
- The frontend also hit production build failures from strict Angular bundle/style budgets. If bot-lobby UI work increases component CSS size again, check `frontend/angular.json` before assuming Docker or Node is the problem.
- On lower-memory Pi hardware, the frontend production build can run out of memory. The setup script warns when swap is too small; in practice, extra swap or cross-building on a stronger machine may be necessary.
- `docker compose logs -f` is a poor fit for unattended setup automation because it blocks forever. The setup flow now tails recent backend logs instead of following continuously.
- The Postgres password generated in `.env` is sensitive and persistent. Do not commit `.env`, and do not rotate `DB_PASSWORD` without understanding that the existing Postgres volume keeps the old credential.
- The production health checks that mattered in practice were:
   - `http://localhost:8000/health`
   - `http://localhost:8000/api/health`
   - `http://<pi-lan-ip>:8000/health`
   - `http://<pi-lan-ip>:8000/api/health`
- Branch-aware hosting matters. When rehosting a non-main branch such as `bot-lobby`, fast-forward the checkout first, then rebuild the stack from that checked-out branch.

Operational guidance for future Pi deploys:

- Rebuild after pulling branch updates with `sudo python3 7handsetup.py update` or re-run `start` after checking out the target branch.
- Use `sudo python3 7handsetup.py verify` after every host-side update.
- Reserve the Pi's LAN IP in the router if other devices will regularly join lobbies on the local network.
- Reboot after large OS/kernel updates before troubleshooting application-level issues.

### Next Steps

- Implement game logic in the backend (`backend/index.js`)
- Build the game UI in the frontend (`frontend/src/app/`)
- Add user authentication, multiplayer support, and cloud deployment as needed.

## Go Backend Server

- **Clean, modular architecture** with comprehensive tests
- **Docker support** for containerized deployment

---

For questions or contributions, open an issue or PR.

# 7hand

is a rummy variation for all ages. featuring 7 hands to play each game!

## Getting Started with Development

first run command to leverage angular tool

```bash
npm install -g @angular/cli
```

## Card Game Monorepo

This project contains both the frontend (Angular) and backend for a multiplayer card game.

### Project Structure

- `frontend/` – Angular app (served on port 4200)
- `backend/` – Express API (served on port 3000) [Legacy]
- `server/` – **Go WebSocket server (port 8080) - GameLift Anywhere compatible**
- `docker-compose.yml` – Orchestrates both services

### Quick Start (with Docker Compose)

1. Build and start both services:

   ```bash
   docker-compose up --build
   ```

2. Access the frontend at: <http://localhost:4200>
3. The backend API is available at: <http://localhost:3000>

### Development

- Code changes in `frontend/` or `backend/` will be reflected in the running containers (volumes are mounted).
- Stop the stack with `Ctrl+C` and remove containers with:

   ```bash
   docker-compose down
   ```

### Next Steps

- Implement game logic in the backend (`backend/index.js`)
- Build the game UI in the frontend (`frontend/src/app/`)
- Add user authentication, multiplayer support, and cloud deployment as needed.

## Go Backend Server

A new **Go-based WebSocket server** has been implemented in the `server/` directory with the following features:

- **Real-time WebSocket communication** using gorilla/websocket
- **In-memory game state management** for lobbies and sessions
- **Amazon GameLift Anywhere integration** ready
- **Clean, modular architecture** with comprehensive tests
- **Docker support** for containerized deployment

### Running the Go Server

```bash
cd server
go run main.go
```

Server runs on port 8080 by default. Connect via WebSocket at `ws://localhost:8080/ws`

For detailed documentation, see [`server/README.md`](server/README.md)

### Features

- Player connect/disconnect handling
- Game lobby creation and management
- Real-time game session support
- JSON message protocol for client/server communication
- Environment-based configuration (PORT, GAME_FLEET_ID, AWS_REGION)
- Comprehensive test coverage

---

For questions or contributions, open an issue or PR.

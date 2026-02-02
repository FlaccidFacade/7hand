# 7hand

is a rummy variation for all ages. featuring 7 hands to play each game!

## Getting Started with Development

ensure you have docker compose in a shell environment. preferably vscode w/ devcontainers extension installed

## Card Game Monorepo

This project contains both the frontend (Angular) and backend for a multiplayer card game.

### Project Structure

- `frontend/` – Angular app (served on port 4200)
- `backend/` – Express API (served on port 3000) [Legacy]
- `docker-compose.yml` – Orchestrates both services

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

### Next Steps

- Implement game logic in the backend (`backend/index.js`)
- Build the game UI in the frontend (`frontend/src/app/`)
- Add user authentication, multiplayer support, and cloud deployment as needed.

## Go Backend Server

- **Clean, modular architecture** with comprehensive tests
- **Docker support** for containerized deployment

---

For questions or contributions, open an issue or PR.

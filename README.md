# seven-hand-card-game

a rummy variation for all ages

## Getting Started with Development

first run command to leverage angular tool

```bash
npm install -g @angular/cli
```

## Card Game Monorepo

This project contains both the frontend (Angular) and backend (Express) for a multiplayer card game.

### Project Structure

- `frontend/` – Angular app (served on port 4200)
- `backend/` – Express API (served on port 3000)
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

---

For questions or contributions, open an issue or PR.

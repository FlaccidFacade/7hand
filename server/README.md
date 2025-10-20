# 7hand - Go Backend Server

This is the Go-based backend server for 7hand, designed for real-time multiplayer gameplay with WebSocket support and Amazon GameLift Anywhere integration.

## Features

- **WebSocket Support**: Real-time bidirectional communication using `gorilla/websocket`
- **Game Management**: In-memory lobby and game state management
- **Player Management**: Connect, disconnect, join/leave lobbies
- **Game Sessions**: Create and join game rooms, start games
- **GameLift Ready**: Prepared for Amazon GameLift Anywhere deployment
- **Clean Architecture**: Modular design with separation of concerns

## Project Structure

```
server/
├── main.go              # Application entry point
├── config/              # Configuration and AWS integration
│   ├── config.go        # Environment configuration
│   └── gamelift.go      # GameLift Anywhere integration
├── models/              # Data models
│   └── models.go        # Player, Lobby, GameState, Card models
├── game/                # Game logic
│   └── manager.go       # Lobby and game session management
├── handlers/            # WebSocket handlers
│   └── websocket.go     # WebSocket connection and message handling
├── Dockerfile           # Container build configuration
└── go.mod               # Go module dependencies
```

## Prerequisites

- Go 1.24 or higher
- Docker (optional, for containerized deployment)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/FlaccidFacade/7hand.git
cd 7hand/server
```

2. Install dependencies:
```bash
go mod download
```

3. Build the server:
```bash
go build -o bin/server .
```

## Running the Server

### Locally

```bash
go run main.go
```

The server will start on port 8080 by default.

### With Environment Variables

```bash
PORT=9000 GAME_FLEET_ID=my-fleet go run main.go
```

### Using Docker

1. Build the Docker image:
```bash
docker build -t 7hand-server .
```

**Note**: If you encounter certificate issues during Docker build, create a vendor directory:
```bash
go mod vendor
```
Then rebuild the Docker image.

2. Run the container:
```bash
docker run -p 8080:8080 7hand-server
```

## Configuration

The server can be configured using environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8080` |
| `GAME_FLEET_ID` | GameLift fleet ID | `local-fleet` |
| `AWS_REGION` | AWS region for GameLift | `us-east-1` |
| `ENVIRONMENT` | Environment (development/production) | `development` |

## WebSocket API

### Connection

Connect to the WebSocket endpoint:
```
ws://localhost:8080/ws
```

### Message Protocol

All messages use JSON format:

```json
{
  "type": "message_type",
  "data": { /* message-specific data */ }
}
```

### Message Types

#### Client → Server

**Connect**
```json
{
  "type": "connect",
  "data": {
    "playerId": "unique-player-id",
    "playerName": "Player Name"
  }
}
```

**Create Lobby**
```json
{
  "type": "create_lobby",
  "data": {
    "playerName": "Player Name"
  }
}
```

**Join Lobby**
```json
{
  "type": "join_lobby",
  "data": {
    "lobbyId": "lobby-uuid",
    "playerName": "Player Name"
  }
}
```

**Leave Lobby**
```json
{
  "type": "leave_lobby",
  "data": {}
}
```

**Start Game**
```json
{
  "type": "start_game",
  "data": {}
}
```

**Play Card**
```json
{
  "type": "play_card",
  "data": {
    "card": { "suit": "hearts", "rank": "A" }
  }
}
```

#### Server → Client

**Connected**
```json
{
  "type": "connected",
  "data": { "status": "ok" }
}
```

**Lobby Created**
```json
{
  "type": "lobby_created",
  "data": {
    "lobbyId": "lobby-uuid",
    "lobby": { /* lobby details */ }
  }
}
```

**Player Joined**
```json
{
  "type": "player_joined",
  "data": {
    "lobbyId": "lobby-uuid",
    "lobby": { /* updated lobby */ },
    "player": { /* player info */ }
  }
}
```

**Player Left**
```json
{
  "type": "player_left",
  "data": {
    "playerId": "player-uuid"
  }
}
```

**Game Started**
```json
{
  "type": "game_started",
  "data": {
    "lobby": { /* lobby with game state */ }
  }
}
```

**Error**
```json
{
  "type": "error",
  "data": {
    "error": "Error message"
  }
}
```

## Testing

Run all tests:
```bash
go test ./... -v
```

Run tests with coverage:
```bash
go test ./... -cover
```

Run specific package tests:
```bash
go test ./models -v
go test ./game -v
```

## HTTP Endpoints

### Health Check
```
GET /health
```
Returns server health status:
```json
{
  "status": "healthy",
  "service": "7hand"
}
```

### Root
```
GET /
```
Returns server info:
```json
{
  "status": "ok",
  "message": "7hand Server"
}
```

## Development

### Adding New Features

1. Define models in `models/models.go`
2. Implement game logic in `game/manager.go`
3. Add message handlers in `handlers/websocket.go`
4. Write tests for new functionality
5. Update this README with new API endpoints

### Code Style

Follow idiomatic Go conventions:
- Use `gofmt` for formatting
- Run `go vet` for static analysis
- Add comments for exported functions
- Keep functions focused and testable

## GameLift Anywhere Integration

The server is prepared for Amazon GameLift Anywhere deployment:

1. The `config/gamelift.go` file contains placeholder integration code
2. AWS SDK for Go v2 is included as a dependency
3. Configuration supports `GAME_FLEET_ID` for fleet identification

### Future GameLift Integration

To complete GameLift Anywhere integration:

1. Implement `RegisterCompute` API call in `gamelift.go`
2. Add `ProcessReady` notification
3. Handle GameSession requests
4. Implement player session validation
5. Add health reporting to GameLift

## Deployment

### Docker Deployment

The included Dockerfile uses multi-stage builds for minimal image size:

```bash
docker build -t 7hand-server:latest .
docker run -p 8080:8080 \
  -e GAME_FLEET_ID=production-fleet \
  -e AWS_REGION=us-east-1 \
  7hand-server:latest
```

### GameLift Anywhere Deployment

1. Build and push Docker image to ECR
2. Register compute with GameLift Anywhere fleet
3. Deploy container to your compute resource
4. Configure networking and security groups
5. Monitor via GameLift console

## Troubleshooting

### Server won't start
- Check if port is already in use: `lsof -i :8080`
- Verify Go version: `go version` (requires 1.24+)

### WebSocket connection fails
- Ensure CORS settings are appropriate for your frontend
- Check firewall rules
- Verify client is connecting to correct WebSocket URL

### Tests fail
- Run `go mod tidy` to ensure dependencies are correct
- Check for conflicting port usage during tests

## Performance

- In-memory game state for low latency
- Goroutines for concurrent client handling
- Automatic cleanup of inactive lobbies
- Connection pooling for WebSocket clients

## Security

- Input validation on all WebSocket messages
- CORS configuration (update for production)
- No sensitive data in logs
- Prepared for AWS IAM integration with GameLift

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new features
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation
- Review WebSocket message protocol

---

**Server Version**: 1.0.0  
**Go Version**: 1.24+  
**Last Updated**: 2025-10-20

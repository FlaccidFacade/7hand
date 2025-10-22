# 7hand Backend (Node.js/Express)

This is the Node.js/Express backend for the 7hand card game. It provides REST API endpoints for user management, lobby creation, and game state persistence.

## Features

- **User Management**: Create, read, update users with statistics tracking
- **Lobby Management**: Create and join game lobbies
- **Database Persistence**: PostgreSQL database with automatic migrations
- **Health Monitoring**: Health check endpoints
- **Comprehensive Testing**: Unit, integration, and database tests

## Project Structure

```
backend/
├── index.js                    # Main application entry point
├── user.js                     # User model and management
├── lobby.js                    # Lobby model and management
├── db.js                       # Database connection and pooling
├── health.js                   # Health check functionality
├── logger.js                   # Winston logger configuration
├── migrations/                 # Database migrations
│   ├── 001_create_lobbies_table.js
│   └── 002_create_users_table.js
└── __tests__/                  # Test files
    ├── user.test.js
    ├── user.db.test.js
    ├── user.api.test.js
    ├── lobby.test.js
    ├── lobby.db.test.js
    ├── lobby.user.integration.test.js
    ├── health.test.js
    ├── db.test.js
    └── index.test.js
```

## Quick Start

### Prerequisites

- Node.js 16+ 
- PostgreSQL 16+
- npm or yarn

### Installation

```bash
cd backend
npm install
```

### Database Setup

Set up environment variables:

```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=card-game
export DB_PASSWORD=changeme
export DB_NAME=card-game-db
```

Run migrations:

```bash
npm run migrate
```

### Running the Server

```bash
npm start
```

Server will start on port 3000.

### Running Tests

```bash
npm test
```

Run tests in serial mode (recommended for database tests):

```bash
npm test -- --runInBand
```

## API Documentation

### User Endpoints

#### Create User
`POST /api/user`

**Request:**
```json
{
  "username": "player123",
  "displayName": "Player 123",
  "email": "player@example.com"
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "player123",
  "displayName": "Player 123",
  "stats": {
    "gamesPlayed": 0,
    "gamesWon": 0,
    "gamesLost": 0
  },
  "createdAt": "2025-10-22T05:00:00.000Z",
  "lastActive": "2025-10-22T05:00:00.000Z"
}
```

#### Get User by ID
`GET /api/user/:userId`

#### Get User by Username
`GET /api/user/username/:username`

#### Get All Users
`GET /api/users`

#### Update User
`PATCH /api/user/:userId`

**Request:**
```json
{
  "displayName": "New Name",
  "stats": {
    "gamesPlayed": 10,
    "gamesWon": 5
  }
}
```

#### Delete User
`DELETE /api/user/:userId`

#### Update User Activity
`POST /api/user/:userId/activity`

For detailed user documentation, see [USER_DOCUMENTATION.md](./USER_DOCUMENTATION.md)

### Lobby Endpoints

#### Create Lobby
`POST /api/lobby`

**Request:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "lobbyId": "760e8500-e29b-41d4-a716-446655440001",
  "users": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "player123",
      "displayName": "Player 123"
    }
  ]
}
```

#### Join Lobby
`POST /api/lobby/:lobbyId/join`

**Request:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Get Lobby
`GET /api/lobby/:lobbyId`

#### Delete Lobby
`DELETE /api/lobby/:lobbyId`

### Health Endpoints

#### Health Check
`GET /health` or `GET /api/health`

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-22T05:00:00.000Z",
  "database": "connected"
}
```

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY,
  username varchar(20) UNIQUE NOT NULL,
  display_name varchar(30) NOT NULL,
  email varchar(255),
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  last_active timestamp DEFAULT now() NOT NULL,
  stats jsonb DEFAULT '{"gamesPlayed":0,"gamesWon":0,"gamesLost":0}' NOT NULL
);
```

### Lobbies Table

```sql
CREATE TABLE lobbies (
  id uuid PRIMARY KEY,
  users jsonb NOT NULL,
  gamestate jsonb,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  last_activity timestamp DEFAULT now() NOT NULL,
  started boolean DEFAULT false NOT NULL
);
```

## Development

### Adding a Migration

Create a new migration file in `migrations/`:

```bash
# migrations/003_add_new_feature.js
exports.up = (pgm) => {
  // Migration up logic
};

exports.down = (pgm) => {
  // Migration down logic
};
```

Run the migration:

```bash
npm run migrate
```

Rollback last migration:

```bash
npm run migrate-down
```

### Code Style

- Use consistent formatting
- Follow existing patterns
- Add JSDoc comments for exported functions
- Write tests for new features

### Testing

Tests are organized by type:
- `*.test.js` - Unit tests (no database)
- `*.db.test.js` - Database tests
- `*.api.test.js` - API endpoint tests
- `*.integration.test.js` - Integration tests

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | Database host | localhost |
| `DB_PORT` | Database port | 5432 |
| `DB_USER` | Database user | card-game |
| `DB_PASSWORD` | Database password | changeme |
| `DB_NAME` | Database name | card-game-db |
| `NODE_ENV` | Environment | development |

## Docker Support

Build and run with Docker:

```bash
docker build -t 7hand-backend .
docker run -p 3000:3000 \
  -e DB_HOST=db \
  -e DB_PASSWORD=secret \
  7hand-backend
```

Or use docker-compose from the root directory:

```bash
docker-compose up backend
```

## Troubleshooting

### Database Connection Issues

Check PostgreSQL is running:
```bash
psql -h localhost -U card-game -d card-game-db
```

Verify environment variables:
```bash
echo $DB_HOST $DB_PORT $DB_USER
```

### Migration Issues

Reset database (WARNING: destroys all data):
```bash
npm run migrate-down
npm run migrate
```

## Contributing

1. Write tests for new features
2. Ensure all tests pass with `npm test -- --runInBand`
3. Follow existing code patterns
4. Update documentation

## License

MIT

## Related Documentation

- [User Documentation](./USER_DOCUMENTATION.md)
- [Main README](../README.md)
- [Go Server](../server/README.md)

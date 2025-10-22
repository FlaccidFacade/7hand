# User Object Documentation

## Overview

The User object represents a player in the 7hand card game system. It includes identity information, statistics, and activity tracking. This document describes the user data structure, storage, validation, and API usage.

## User Object Structure

### JavaScript/Node.js (Backend)

```javascript
{
  id: "uuid-v4",                    // Unique identifier (auto-generated)
  username: "string",               // Unique username (3-20 characters)
  displayName: "string",            // Display name shown in game (up to 30 characters)
  email: "string|null",             // Optional email address
  createdAt: Date,                  // Account creation timestamp
  updatedAt: Date,                  // Last modification timestamp
  lastActive: Date,                 // Last activity timestamp
  stats: {
    gamesPlayed: number,            // Total games played
    gamesWon: number,               // Total games won
    gamesLost: number               // Total games lost
  }
}
```

## Database Schema

The user data is stored in PostgreSQL using the following schema:

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

CREATE INDEX users_username_index ON users (username);
CREATE INDEX users_last_active_index ON users (last_active);
```

## Validation Rules

### Username
- **Required**: Yes
- **Type**: String
- **Length**: 3-20 characters
- **Format**: Only letters, numbers, hyphens, and underscores (`^[a-zA-Z0-9_-]+$`)
- **Unique**: Yes

### Display Name
- **Required**: No (defaults to username if not provided)
- **Type**: String
- **Length**: Maximum 30 characters

### Email
- **Required**: No
- **Type**: String or null
- **Format**: Valid email format (RFC 5322 compliant)

### Stats
- **Required**: Yes (auto-initialized if not provided)
- **Type**: Object
- **Properties**:
  - `gamesPlayed`: Non-negative integer
  - `gamesWon`: Non-negative integer
  - `gamesLost`: Non-negative integer

## API Endpoints

### Create User

**POST** `/api/user`

Creates a new user account.

**Request Body:**
```json
{
  "username": "player123",
  "displayName": "Player 123",
  "email": "player@example.com"
}
```

**Success Response (200):**
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

**Error Response (400):**
```json
{
  "error": "User validation failed: Username must be between 3 and 20 characters"
}
```

### Get User by ID

**GET** `/api/user/:userId`

Retrieves user information by user ID.

**Success Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "player123",
  "displayName": "Player 123",
  "stats": {
    "gamesPlayed": 10,
    "gamesWon": 5,
    "gamesLost": 5
  },
  "createdAt": "2025-10-22T05:00:00.000Z",
  "lastActive": "2025-10-22T05:30:00.000Z"
}
```

**Error Response (404):**
```json
{
  "error": "User not found"
}
```

### Get User by Username

**GET** `/api/user/username/:username`

Retrieves user information by username.

**Success Response (200):**
Same as Get User by ID

**Error Response (404):**
```json
{
  "error": "User not found"
}
```

### Get All Users

**GET** `/api/users`

Retrieves all users, ordered by creation date (newest first).

**Success Response (200):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "player123",
    "displayName": "Player 123",
    "stats": { ... },
    "createdAt": "2025-10-22T05:00:00.000Z",
    "lastActive": "2025-10-22T05:30:00.000Z"
  },
  ...
]
```

### Update User

**PATCH** `/api/user/:userId`

Updates user information. Username cannot be changed.

**Request Body:**
```json
{
  "displayName": "New Display Name",
  "email": "newemail@example.com",
  "stats": {
    "gamesPlayed": 15,
    "gamesWon": 8
  }
}
```

**Success Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "player123",
  "displayName": "New Display Name",
  "stats": {
    "gamesPlayed": 15,
    "gamesWon": 8,
    "gamesLost": 5
  },
  "createdAt": "2025-10-22T05:00:00.000Z",
  "lastActive": "2025-10-22T05:30:00.000Z"
}
```

**Error Responses:**
- **404**: User not found
- **400**: Validation failed

### Update User Activity

**POST** `/api/user/:userId/activity`

Updates the user's last activity timestamp.

**Success Response (200):**
```json
{
  "success": true
}
```

**Error Response (404):**
```json
{
  "error": "User not found"
}
```

### Delete User

**DELETE** `/api/user/:userId`

Deletes a user account.

**Success Response (200):**
```json
{
  "success": true
}
```

## Usage Examples

### Creating a User in JavaScript

```javascript
const { User, UserManager } = require('./user');

// Create a user manager instance
const userManager = new UserManager();

// Create a new user
const user = userManager.createUser({
  username: 'player123',
  displayName: 'Player 123',
  email: 'player@example.com'
});

// The user is automatically validated
console.log(user.id); // UUID v4
console.log(user.stats); // { gamesPlayed: 0, gamesWon: 0, gamesLost: 0 }
```

### Validating User Data

```javascript
const user = new User({
  username: 'player123',
  displayName: 'Player 123'
});

const validation = user.validate();
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
} else {
  console.log('User is valid');
}
```

### Updating User Stats

```javascript
// Update stats after a game
user.updateStats({
  gamesPlayed: user.stats.gamesPlayed + 1,
  gamesWon: user.stats.gamesWon + 1
});
```

### Getting Safe User Object

```javascript
// Get user object without sensitive data (e.g., email)
const safeUser = user.toSafeObject();
// Returns: { id, username, displayName, stats, createdAt, lastActive }
```

### Working with Database

```javascript
const { saveUserToDb, loadUserFromDb } = require('./user');

// Save user to database
await saveUserToDb(user);

// Load user from database
const loadedUser = await loadUserFromDb(userId);

// The loaded user is a plain object, recreate User instance if needed
const userInstance = new User(loadedUser);
```

## Security Considerations

1. **Email Privacy**: Email addresses are not exposed in API responses (via `toSafeObject()`)
2. **Username Uniqueness**: Enforced at database level with unique constraint
3. **Input Validation**: All user input is validated before saving
4. **Safe Object Serialization**: Use `toSafeObject()` when sending user data to clients

## Storage & Performance

- **In-Memory Cache**: The `UserManager` maintains an in-memory cache of active users
- **Database Persistence**: All user data is persisted to PostgreSQL
- **Indexes**: Optimized queries with indexes on `username` and `last_active`
- **Activity Tracking**: Automatic timestamp updates for user activity

## Integration with Game System

Users are referenced in the lobby system by their user ID:

```javascript
// Creating a lobby with a user
const lobby = lobbyManager.createLobby(user.toSafeObject());

// Adding a user to a lobby
lobby.addUser(user.toSafeObject());
```

## Migration

To apply the user table schema to your database:

```bash
cd backend
npm run migrate
```

This will create the `users` table with all necessary indexes and constraints.

## Testing

Comprehensive tests are available in:
- `__tests__/user.test.js` - Unit tests for User class and UserManager
- `__tests__/user.db.test.js` - Database operations tests
- `__tests__/user.api.test.js` - API endpoint tests

Run tests with:
```bash
npm test
```

## Future Enhancements

Potential improvements to the user system:

1. **Authentication**: Add password hashing and authentication
2. **Roles & Permissions**: Implement user roles (admin, player, guest)
3. **Profile Pictures**: Add avatar/profile picture support
4. **Friends System**: User relationships and friends list
5. **Achievements**: Track and award achievements
6. **Rating/ELO**: Competitive ranking system
7. **Session Management**: Track user sessions and devices
8. **Account Recovery**: Email-based password recovery

## Related Documentation

- [Lobby System](./lobby.js)
- [Database Schema](./migrations/)
- [API Documentation](../README.md)

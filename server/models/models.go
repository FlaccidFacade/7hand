package models

import (
	"errors"
	"regexp"
	"time"

	"github.com/google/uuid"
)

// UserStats represents user game statistics
type UserStats struct {
	GamesPlayed int `json:"gamesPlayed"`
	GamesWon    int `json:"gamesWon"`
	GamesLost   int `json:"gamesLost"`
}

// User represents a registered user in the system
type User struct {
	ID          string     `json:"id"`
	Username    string     `json:"username"`
	DisplayName string     `json:"displayName"`
	Email       string     `json:"email,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
	LastActive  time.Time  `json:"lastActive"`
	Stats       UserStats  `json:"stats"`
}

// NewUser creates a new user instance
func NewUser(username, displayName string) (*User, error) {
	if err := ValidateUsername(username); err != nil {
		return nil, err
	}

	if displayName == "" {
		displayName = username
	}

	return &User{
		ID:          uuid.New().String(),
		Username:    username,
		DisplayName: displayName,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		LastActive:  time.Now(),
		Stats: UserStats{
			GamesPlayed: 0,
			GamesWon:    0,
			GamesLost:   0,
		},
	}, nil
}

// ValidateUsername validates username according to rules
func ValidateUsername(username string) error {
	if username == "" {
		return errors.New("username is required")
	}
	if len(username) < 3 || len(username) > 20 {
		return errors.New("username must be between 3 and 20 characters")
	}
	matched, _ := regexp.MatchString("^[a-zA-Z0-9_-]+$", username)
	if !matched {
		return errors.New("username can only contain letters, numbers, hyphens, and underscores")
	}
	return nil
}

// UpdateActivity updates the user's last activity timestamp
func (u *User) UpdateActivity() {
	u.LastActive = time.Now()
	u.UpdatedAt = time.Now()
}

// UpdateStats updates the user's game statistics
func (u *User) UpdateStats(stats UserStats) {
	u.Stats = stats
	u.UpdatedAt = time.Now()
}

// ToSafeObject returns user data without sensitive information
func (u *User) ToSafeObject() map[string]interface{} {
	return map[string]interface{}{
		"id":          u.ID,
		"username":    u.Username,
		"displayName": u.DisplayName,
		"stats":       u.Stats,
		"createdAt":   u.CreatedAt,
		"lastActive":  u.LastActive,
	}
}

// Player represents a connected player
type Player struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Connected bool      `json:"connected"`
	JoinedAt  time.Time `json:"joinedAt"`
}

// NewPlayer creates a new player instance
func NewPlayer(id, name string) *Player {
	return &Player{
		ID:        id,
		Name:      name,
		Connected: true,
		JoinedAt:  time.Now(),
	}
}

// Lobby represents a game lobby/room
type Lobby struct {
	ID           string     `json:"id"`
	Players      []*Player  `json:"players"`
	MaxPlayers   int        `json:"maxPlayers"`
	CreatedAt    time.Time  `json:"createdAt"`
	LastActivity time.Time  `json:"lastActivity"`
	Started      bool       `json:"started"`
	GameState    *GameState `json:"gameState,omitempty"`
}

// NewLobby creates a new lobby instance
func NewLobby(hostPlayer *Player) *Lobby {
	return &Lobby{
		ID:           uuid.New().String(),
		Players:      []*Player{hostPlayer},
		MaxPlayers:   4,
		CreatedAt:    time.Now(),
		LastActivity: time.Now(),
		Started:      false,
	}
}

// AddPlayer adds a player to the lobby
func (l *Lobby) AddPlayer(player *Player) bool {
	if len(l.Players) >= l.MaxPlayers {
		return false
	}

	// Check if player already exists
	for _, p := range l.Players {
		if p.ID == player.ID {
			return false
		}
	}

	l.Players = append(l.Players, player)
	l.LastActivity = time.Now()
	return true
}

// RemovePlayer removes a player from the lobby
func (l *Lobby) RemovePlayer(playerID string) bool {
	for i, p := range l.Players {
		if p.ID == playerID {
			l.Players = append(l.Players[:i], l.Players[i+1:]...)
			l.LastActivity = time.Now()
			return true
		}
	}
	return false
}

// GetPlayer retrieves a player by ID
func (l *Lobby) GetPlayer(playerID string) *Player {
	for _, p := range l.Players {
		if p.ID == playerID {
			return p
		}
	}
	return nil
}

// GameState represents the state of an active game
type GameState struct {
	CurrentRound int               `json:"currentRound"`
	CurrentTurn  int               `json:"currentTurn"`
	Deck         []Card            `json:"deck"`
	DiscardPile  []Card            `json:"discardPile"`
	PlayerHands  map[string][]Card `json:"playerHands"`
	Started      bool              `json:"started"`
}

// Card represents a playing card
type Card struct {
	Suit  string `json:"suit"`  // "hearts", "diamonds", "clubs", "spades"
	Rank  string `json:"rank"`  // "A", "2", "3", ..., "10", "J", "Q", "K"
	Value int    `json:"value"` // Point value
}

// NewGameState creates a new game state
func NewGameState() *GameState {
	return &GameState{
		CurrentRound: 1,
		CurrentTurn:  0,
		Deck:         []Card{},
		DiscardPile:  []Card{},
		PlayerHands:  make(map[string][]Card),
		Started:      false,
	}
}

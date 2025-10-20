package models

import (
	"time"

	"github.com/google/uuid"
)

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
	ID           string    `json:"id"`
	Players      []*Player `json:"players"`
	MaxPlayers   int       `json:"maxPlayers"`
	CreatedAt    time.Time `json:"createdAt"`
	LastActivity time.Time `json:"lastActivity"`
	Started      bool      `json:"started"`
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
	CurrentRound int           `json:"currentRound"`
	CurrentTurn  int           `json:"currentTurn"`
	Deck         []Card        `json:"deck"`
	DiscardPile  []Card        `json:"discardPile"`
	PlayerHands  map[string][]Card `json:"playerHands"`
	Started      bool          `json:"started"`
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

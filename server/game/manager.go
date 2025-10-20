package game

import (
	"log"
	"sync"
	"time"

	"github.com/FlaccidFacade/7hand/server/models"
)

// Manager handles all game lobbies and sessions
type Manager struct {
	lobbies map[string]*models.Lobby
	mu      sync.RWMutex
}

// NewManager creates a new game manager
func NewManager() *Manager {
	m := &Manager{
		lobbies: make(map[string]*models.Lobby),
	}

	// Start cleanup routine
	go m.cleanupInactiveLobbies()

	return m
}

// CreateLobby creates a new lobby with a host player
func (m *Manager) CreateLobby(hostPlayer *models.Player) *models.Lobby {
	m.mu.Lock()
	defer m.mu.Unlock()

	lobby := models.NewLobby(hostPlayer)
	m.lobbies[lobby.ID] = lobby

	log.Printf("Created lobby %s with host %s", lobby.ID, hostPlayer.ID)
	return lobby
}

// GetLobby retrieves a lobby by ID
func (m *Manager) GetLobby(lobbyID string) (*models.Lobby, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	lobby, exists := m.lobbies[lobbyID]
	return lobby, exists
}

// JoinLobby adds a player to an existing lobby
func (m *Manager) JoinLobby(lobbyID string, player *models.Player) (*models.Lobby, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	lobby, exists := m.lobbies[lobbyID]
	if !exists {
		return nil, false
	}

	if !lobby.AddPlayer(player) {
		return lobby, false
	}

	log.Printf("Player %s joined lobby %s", player.ID, lobbyID)
	return lobby, true
}

// LeaveLobby removes a player from a lobby
func (m *Manager) LeaveLobby(lobbyID, playerID string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	lobby, exists := m.lobbies[lobbyID]
	if !exists {
		return false
	}

	removed := lobby.RemovePlayer(playerID)

	// Remove lobby if empty
	if len(lobby.Players) == 0 {
		delete(m.lobbies, lobbyID)
		log.Printf("Removed empty lobby %s", lobbyID)
	} else {
		log.Printf("Player %s left lobby %s", playerID, lobbyID)
	}

	return removed
}

// StartGame initializes the game state for a lobby
func (m *Manager) StartGame(lobbyID string) (*models.Lobby, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	lobby, exists := m.lobbies[lobbyID]
	if !exists {
		return nil, false
	}

	if lobby.Started {
		return lobby, false
	}

	if len(lobby.Players) < 2 {
		return lobby, false
	}

	lobby.Started = true
	lobby.GameState = models.NewGameState()
	lobby.GameState.Started = true

	// Initialize game state for each player
	for _, player := range lobby.Players {
		lobby.GameState.PlayerHands[player.ID] = []models.Card{}
	}

	log.Printf("Started game in lobby %s with %d players", lobbyID, len(lobby.Players))
	return lobby, true
}

// cleanupInactiveLobbies removes lobbies that haven't been active for 2 hours
func (m *Manager) cleanupInactiveLobbies() {
	ticker := time.NewTicker(30 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		m.mu.Lock()
		cutoff := time.Now().Add(-2 * time.Hour)

		for id, lobby := range m.lobbies {
			if lobby.LastActivity.Before(cutoff) {
				delete(m.lobbies, id)
				log.Printf("Cleaned up inactive lobby %s", id)
			}
		}
		m.mu.Unlock()
	}
}

// GetAllLobbies returns all active lobbies (for debugging/admin)
func (m *Manager) GetAllLobbies() []*models.Lobby {
	m.mu.RLock()
	defer m.mu.RUnlock()

	lobbies := make([]*models.Lobby, 0, len(m.lobbies))
	for _, lobby := range m.lobbies {
		lobbies = append(lobbies, lobby)
	}

	return lobbies
}

package game

import (
	"testing"

	"github.com/FlaccidFacade/seven-hand-card-game/server/models"
)

func TestNewManager(t *testing.T) {
	manager := NewManager()
	
	if manager == nil {
		t.Error("Failed to create manager")
	}
	
	if manager.lobbies == nil {
		t.Error("Manager lobbies map should be initialized")
	}
}

func TestCreateLobby(t *testing.T) {
	manager := NewManager()
	host := models.NewPlayer("host", "Host Player")
	
	lobby := manager.CreateLobby(host)
	
	if lobby == nil {
		t.Error("Failed to create lobby")
	}
	
	if len(lobby.Players) != 1 {
		t.Errorf("Expected 1 player, got %d", len(lobby.Players))
	}
	
	// Verify lobby is stored in manager
	retrievedLobby, exists := manager.GetLobby(lobby.ID)
	if !exists {
		t.Error("Lobby not found in manager")
	}
	
	if retrievedLobby.ID != lobby.ID {
		t.Error("Retrieved lobby ID mismatch")
	}
}

func TestJoinLobby(t *testing.T) {
	manager := NewManager()
	host := models.NewPlayer("host", "Host")
	lobby := manager.CreateLobby(host)
	
	player2 := models.NewPlayer("player2", "Player 2")
	joinedLobby, success := manager.JoinLobby(lobby.ID, player2)
	
	if !success {
		t.Error("Failed to join lobby")
	}
	
	if len(joinedLobby.Players) != 2 {
		t.Errorf("Expected 2 players, got %d", len(joinedLobby.Players))
	}
}

func TestJoinNonexistentLobby(t *testing.T) {
	manager := NewManager()
	player := models.NewPlayer("player", "Player")
	
	_, success := manager.JoinLobby("nonexistent", player)
	
	if success {
		t.Error("Should not be able to join nonexistent lobby")
	}
}

func TestLeaveLobby(t *testing.T) {
	manager := NewManager()
	host := models.NewPlayer("host", "Host")
	player2 := models.NewPlayer("player2", "Player 2")
	
	lobby := manager.CreateLobby(host)
	manager.JoinLobby(lobby.ID, player2)
	
	success := manager.LeaveLobby(lobby.ID, "player2")
	
	if !success {
		t.Error("Failed to leave lobby")
	}
	
	// Verify player was removed
	retrievedLobby, exists := manager.GetLobby(lobby.ID)
	if !exists {
		t.Error("Lobby should still exist")
	}
	
	if len(retrievedLobby.Players) != 1 {
		t.Errorf("Expected 1 player after leave, got %d", len(retrievedLobby.Players))
	}
}

func TestLeaveLobbyEmptyRemoval(t *testing.T) {
	manager := NewManager()
	host := models.NewPlayer("host", "Host")
	
	lobby := manager.CreateLobby(host)
	lobbyID := lobby.ID
	
	// Last player leaves
	manager.LeaveLobby(lobbyID, "host")
	
	// Lobby should be removed
	_, exists := manager.GetLobby(lobbyID)
	if exists {
		t.Error("Empty lobby should be removed")
	}
}

func TestStartGame(t *testing.T) {
	manager := NewManager()
	host := models.NewPlayer("host", "Host")
	player2 := models.NewPlayer("player2", "Player 2")
	
	lobby := manager.CreateLobby(host)
	manager.JoinLobby(lobby.ID, player2)
	
	startedLobby, success := manager.StartGame(lobby.ID)
	
	if !success {
		t.Error("Failed to start game")
	}
	
	if !startedLobby.Started {
		t.Error("Lobby should be marked as started")
	}
	
	if startedLobby.GameState == nil {
		t.Error("Game state should be initialized")
	}
	
	if !startedLobby.GameState.Started {
		t.Error("Game state should be marked as started")
	}
}

func TestStartGameInsufficientPlayers(t *testing.T) {
	manager := NewManager()
	host := models.NewPlayer("host", "Host")
	
	lobby := manager.CreateLobby(host)
	
	_, success := manager.StartGame(lobby.ID)
	
	if success {
		t.Error("Should not be able to start game with only 1 player")
	}
}

func TestStartGameAlreadyStarted(t *testing.T) {
	manager := NewManager()
	host := models.NewPlayer("host", "Host")
	player2 := models.NewPlayer("player2", "Player 2")
	
	lobby := manager.CreateLobby(host)
	manager.JoinLobby(lobby.ID, player2)
	manager.StartGame(lobby.ID)
	
	// Try to start again
	_, success := manager.StartGame(lobby.ID)
	
	if success {
		t.Error("Should not be able to start already started game")
	}
}

func TestGetAllLobbies(t *testing.T) {
	manager := NewManager()
	
	// Create multiple lobbies
	for i := 0; i < 3; i++ {
		host := models.NewPlayer("host", "Host")
		manager.CreateLobby(host)
	}
	
	lobbies := manager.GetAllLobbies()
	
	if len(lobbies) != 3 {
		t.Errorf("Expected 3 lobbies, got %d", len(lobbies))
	}
}

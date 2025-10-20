package models

import (
	"testing"
)

func TestNewPlayer(t *testing.T) {
	player := NewPlayer("player1", "Test Player")
	
	if player.ID != "player1" {
		t.Errorf("Expected player ID 'player1', got '%s'", player.ID)
	}
	
	if player.Name != "Test Player" {
		t.Errorf("Expected player name 'Test Player', got '%s'", player.Name)
	}
	
	if !player.Connected {
		t.Error("Expected player to be connected")
	}
}

func TestNewLobby(t *testing.T) {
	player := NewPlayer("host", "Host Player")
	lobby := NewLobby(player)
	
	if len(lobby.Players) != 1 {
		t.Errorf("Expected 1 player, got %d", len(lobby.Players))
	}
	
	if lobby.Players[0].ID != "host" {
		t.Error("Host player not properly added to lobby")
	}
	
	if lobby.Started {
		t.Error("New lobby should not be started")
	}
}

func TestLobbyAddPlayer(t *testing.T) {
	host := NewPlayer("host", "Host")
	lobby := NewLobby(host)
	
	player2 := NewPlayer("player2", "Player 2")
	success := lobby.AddPlayer(player2)
	
	if !success {
		t.Error("Failed to add player to lobby")
	}
	
	if len(lobby.Players) != 2 {
		t.Errorf("Expected 2 players, got %d", len(lobby.Players))
	}
}

func TestLobbyAddDuplicatePlayer(t *testing.T) {
	host := NewPlayer("host", "Host")
	lobby := NewLobby(host)
	
	// Try to add same player again
	success := lobby.AddPlayer(host)
	
	if success {
		t.Error("Should not be able to add duplicate player")
	}
	
	if len(lobby.Players) != 1 {
		t.Errorf("Expected 1 player, got %d", len(lobby.Players))
	}
}

func TestLobbyRemovePlayer(t *testing.T) {
	host := NewPlayer("host", "Host")
	player2 := NewPlayer("player2", "Player 2")
	lobby := NewLobby(host)
	lobby.AddPlayer(player2)
	
	success := lobby.RemovePlayer("player2")
	
	if !success {
		t.Error("Failed to remove player from lobby")
	}
	
	if len(lobby.Players) != 1 {
		t.Errorf("Expected 1 player after removal, got %d", len(lobby.Players))
	}
}

func TestLobbyGetPlayer(t *testing.T) {
	host := NewPlayer("host", "Host")
	lobby := NewLobby(host)
	
	player := lobby.GetPlayer("host")
	if player == nil {
		t.Error("Failed to get player from lobby")
	}
	
	if player.ID != "host" {
		t.Errorf("Expected player ID 'host', got '%s'", player.ID)
	}
	
	nilPlayer := lobby.GetPlayer("nonexistent")
	if nilPlayer != nil {
		t.Error("Expected nil for nonexistent player")
	}
}

func TestLobbyMaxPlayers(t *testing.T) {
	host := NewPlayer("host", "Host")
	lobby := NewLobby(host)
	
	// Add players up to max
	for i := 1; i < lobby.MaxPlayers; i++ {
		player := NewPlayer("player"+string(rune('0'+i)), "Player")
		lobby.AddPlayer(player)
	}
	
	// Try to add one more
	extraPlayer := NewPlayer("extra", "Extra")
	success := lobby.AddPlayer(extraPlayer)
	
	if success {
		t.Error("Should not be able to exceed max players")
	}
}

func TestNewGameState(t *testing.T) {
	gameState := NewGameState()
	
	if gameState.CurrentRound != 1 {
		t.Errorf("Expected round 1, got %d", gameState.CurrentRound)
	}
	
	if gameState.Started {
		t.Error("New game state should not be started")
	}
	
	if gameState.PlayerHands == nil {
		t.Error("PlayerHands should be initialized")
	}
}

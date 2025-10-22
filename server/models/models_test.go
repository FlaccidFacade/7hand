package models

import (
	"testing"
)

func TestNewUser(t *testing.T) {
	user, err := NewUser("testuser", "Test User")

	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if user.Username != "testuser" {
		t.Errorf("Expected username 'testuser', got '%s'", user.Username)
	}

	if user.DisplayName != "Test User" {
		t.Errorf("Expected display name 'Test User', got '%s'", user.DisplayName)
	}

	if user.ID == "" {
		t.Error("Expected user ID to be generated")
	}

	if user.Stats.GamesPlayed != 0 {
		t.Errorf("Expected 0 games played, got %d", user.Stats.GamesPlayed)
	}
}

func TestNewUserDefaultDisplayName(t *testing.T) {
	user, _ := NewUser("testuser", "")

	if user.DisplayName != "testuser" {
		t.Errorf("Expected display name to default to username, got '%s'", user.DisplayName)
	}
}

func TestValidateUsername(t *testing.T) {
	tests := []struct {
		username string
		wantErr  bool
	}{
		{"validuser", false},
		{"valid-user_123", false},
		{"ab", true},                   // too short
		{"a1234567890123456789012", true}, // too long
		{"invalid@user", true},         // invalid characters
		{"", true},                     // empty
		{"valid_user", false},
		{"VALID123", false},
	}

	for _, tt := range tests {
		err := ValidateUsername(tt.username)
		if (err != nil) != tt.wantErr {
			t.Errorf("ValidateUsername(%s) error = %v, wantErr %v", tt.username, err, tt.wantErr)
		}
	}
}

func TestUserUpdateActivity(t *testing.T) {
	user, _ := NewUser("testuser", "Test User")
	originalLastActive := user.LastActive

	user.UpdateActivity()

	if !user.LastActive.After(originalLastActive) && !user.LastActive.Equal(originalLastActive) {
		t.Error("Expected LastActive to be updated")
	}
}

func TestUserUpdateStats(t *testing.T) {
	user, _ := NewUser("testuser", "Test User")

	newStats := UserStats{
		GamesPlayed: 10,
		GamesWon:    5,
		GamesLost:   5,
	}

	user.UpdateStats(newStats)

	if user.Stats.GamesPlayed != 10 {
		t.Errorf("Expected 10 games played, got %d", user.Stats.GamesPlayed)
	}

	if user.Stats.GamesWon != 5 {
		t.Errorf("Expected 5 games won, got %d", user.Stats.GamesWon)
	}
}

func TestUserToSafeObject(t *testing.T) {
	user, _ := NewUser("testuser", "Test User")
	user.Email = "test@example.com"

	safeObj := user.ToSafeObject()

	if safeObj["username"] != "testuser" {
		t.Error("Expected username in safe object")
	}

	if safeObj["displayName"] != "Test User" {
		t.Error("Expected display name in safe object")
	}

	if _, exists := safeObj["email"]; exists {
		t.Error("Email should not be in safe object")
	}

	if safeObj["id"] == nil {
		t.Error("Expected id in safe object")
	}
}

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

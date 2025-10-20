package config

import (
	"testing"

	"github.com/FlaccidFacade/7hand/server/game"
	"github.com/amazon-gamelift/amazon-gamelift-servers-go-server-sdk/model"
)

func TestNewGameLiftClient(t *testing.T) {
	cfg := &Config{
		Port:        "8080",
		GameFleetID: "test-fleet",
		AWSRegion:   "us-east-1",
		Environment: "test",
	}

	client, err := NewGameLiftClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create GameLift client: %v", err)
	}

	if client == nil {
		t.Fatal("GameLift client is nil")
	}

	if client.cfg != cfg {
		t.Error("GameLift client config mismatch")
	}

	if client.isInitialized {
		t.Error("GameLift client should not be initialized yet")
	}
}

func TestNewGameLiftCallbacks(t *testing.T) {
	cfg := &Config{
		Port:        "8080",
		GameFleetID: "test-fleet",
		AWSRegion:   "us-east-1",
		Environment: "test",
	}

	gameManager := game.NewManager()
	client, _ := NewGameLiftClient(cfg)
	callbacks := NewGameLiftCallbacks(gameManager, client)

	if callbacks == nil {
		t.Fatal("GameLift callbacks is nil")
	}

	if callbacks.gameManager != gameManager {
		t.Error("GameLift callbacks game manager mismatch")
	}

	if callbacks.gameLiftClient != client {
		t.Error("GameLift callbacks client mismatch")
	}
}

func TestOnHealthCheck(t *testing.T) {
	gameManager := game.NewManager()
	client, _ := NewGameLiftClient(&Config{})
	callbacks := NewGameLiftCallbacks(gameManager, client)

	// OnHealthCheck should always return true in our basic implementation
	healthy := callbacks.OnHealthCheck()
	if !healthy {
		t.Error("OnHealthCheck should report healthy")
	}
}

func TestOnStartGameSession(t *testing.T) {
	gameManager := game.NewManager()
	client, _ := NewGameLiftClient(&Config{})
	callbacks := NewGameLiftCallbacks(gameManager, client)

	// Create a mock game session
	gameSession := model.GameSession{
		GameSessionID:             "test-session-123",
		MaximumPlayerSessionCount: 4,
		Name:                      "Test Game",
	}

	// Call the callback - it should handle the nil GameLift client gracefully
	callbacks.OnStartGameSession(gameSession)

	// If we get here without panicking, the test passes
}

func TestOnProcessTerminate(t *testing.T) {
	gameManager := game.NewManager()
	client, _ := NewGameLiftClient(&Config{})
	callbacks := NewGameLiftCallbacks(gameManager, client)

	// Call the callback - it should handle the nil GameLift client gracefully
	callbacks.OnProcessTerminate()

	// If we get here without panicking, the test passes
}

func TestOnUpdateGameSession(t *testing.T) {
	gameManager := game.NewManager()
	client, _ := NewGameLiftClient(&Config{})
	callbacks := NewGameLiftCallbacks(gameManager, client)

	// Create a mock update game session
	updateReason := model.MatchmakingDataUpdated
	updateGameSession := model.UpdateGameSession{
		GameSession: model.GameSession{
			GameSessionID:             "test-session-123",
			MaximumPlayerSessionCount: 4,
		},
		UpdateReason:     &updateReason,
		BackfillTicketID: "test-ticket",
	}

	// Call the callback
	callbacks.OnUpdateGameSession(updateGameSession)
}

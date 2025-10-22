package config

import (
	"log"

	"github.com/FlaccidFacade/7hand/server/game"
	"github.com/amazon-gamelift/amazon-gamelift-servers-go-server-sdk/model"
)

// GameLiftCallbacks holds the callback implementations for GameLift Server SDK
type GameLiftCallbacks struct {
	gameManager    *game.Manager
	gameLiftClient *GameLiftClient
}

// NewGameLiftCallbacks creates a new callback handler
func NewGameLiftCallbacks(gameManager *game.Manager, gameLiftClient *GameLiftClient) *GameLiftCallbacks {
	return &GameLiftCallbacks{
		gameManager:    gameManager,
		gameLiftClient: gameLiftClient,
	}
}

// OnStartGameSession handles the game session start callback from GameLift
// This callback is NOT marked as optional in AWS documentation - it's required
func (cb *GameLiftCallbacks) OnStartGameSession(gameSession model.GameSession) {
	log.Printf("GameLift OnStartGameSession: %s", gameSession.GameSessionID)

	// Create a lobby in our game manager based on the GameLift session
	// The GameSession object contains important information like:
	// - GameSessionID: unique identifier for the game session
	// - MaximumPlayerSessionCount: max players allowed
	// - GameProperties: custom game properties
	// - GameSessionData: additional session data

	log.Printf("Game session properties: MaxPlayers=%d, SessionID=%s",
		gameSession.MaximumPlayerSessionCount, gameSession.GameSessionID)

	// Notify GameLift that we're ready to accept players
	// Only call if gameLiftClient is available and SDK is initialized
	if cb.gameLiftClient != nil && cb.gameLiftClient.isInitialized {
		err := cb.gameLiftClient.ActivateGameSession()
		if err != nil {
			log.Printf("Failed to activate game session: %v", err)
			return
		}
		log.Printf("Game session %s is now active and ready for players", gameSession.GameSessionID)
	} else {
		log.Printf("GameLift SDK not initialized, skipping ActivateGameSession")
	}
}

// OnProcessTerminate handles the process termination callback from GameLift
// This callback is NOT marked as optional in AWS documentation - it's required
// GameLift gives the server process up to 5 minutes to shut down gracefully
func (cb *GameLiftCallbacks) OnProcessTerminate() {
	log.Printf("GameLift OnProcessTerminate: Server process is being terminated")

	// Get termination time if available
	// Only call if gameLiftClient is available and SDK is initialized
	if cb.gameLiftClient != nil && cb.gameLiftClient.isInitialized {
		terminationTime, err := cb.gameLiftClient.GetTerminationTime()
		if err == nil {
			log.Printf("Estimated termination time: %d", terminationTime)
		}
	}

	// Perform cleanup tasks:
	// 1. Disconnect all players gracefully
	// 2. Save game state if needed
	// 3. Clean up resources

	// Notify GameLift that we're shutting down
	if cb.gameLiftClient != nil && cb.gameLiftClient.isInitialized {
		err := cb.gameLiftClient.ProcessEnding()
		if err != nil {
			log.Printf("Error notifying GameLift of process ending: %v", err)
		}
	} else {
		log.Printf("GameLift SDK not initialized, skipping ProcessEnding")
	}

	log.Printf("Server process shutdown complete")
}

// OnHealthCheck reports the health status of the server process
// This callback IS marked as optional in AWS documentation
// However, implementing it is strongly recommended for production deployments
// GameLift calls this every 60 seconds and expects a response within 60 seconds
func (cb *GameLiftCallbacks) OnHealthCheck() bool {
	// Perform health checks:
	// - Check if critical dependencies are available
	// - Verify server resources are adequate
	// - Ensure no deadlocks or hung processes

	// For now, we always report healthy
	// In production, you should implement actual health checks
	isHealthy := true

	log.Printf("GameLift OnHealthCheck: reporting healthy=%v", isHealthy)
	return isHealthy
}

// OnUpdateGameSession handles game session updates from GameLift
// This callback IS marked as optional in AWS documentation
// It's required for FlexMatch backfill feature
func (cb *GameLiftCallbacks) OnUpdateGameSession(updateGameSession model.UpdateGameSession) {
	updateReasonStr := "Unknown"
	if updateGameSession.UpdateReason != nil {
		if *updateGameSession.UpdateReason == model.MatchmakingDataUpdated {
			updateReasonStr = "MatchmakingDataUpdated"
		}
	}

	log.Printf("GameLift OnUpdateGameSession: SessionID=%s, UpdateReason=%s",
		updateGameSession.GameSession.GameSessionID, updateReasonStr)

	// Handle game session updates, particularly for FlexMatch backfill
	// The UpdateGameSession contains:
	// - GameSession: updated game session object with new matchmaker data
	// - UpdateReason: reason for the update (e.g., MatchmakingDataUpdated)
	// - BackfillTicketID: ID of the backfill ticket if applicable

	if updateGameSession.UpdateReason != nil && *updateGameSession.UpdateReason == model.MatchmakingDataUpdated {
		log.Printf("Matchmaking data updated, processing new player matchmaker data")
		// Process updated matchmaker data here
	}
}

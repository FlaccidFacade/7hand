package config

import (
	"log"

	"github.com/amazon-gamelift/amazon-gamelift-servers-go-server-sdk/model"
	"github.com/amazon-gamelift/amazon-gamelift-servers-go-server-sdk/server"
)

// GameLiftClient wraps AWS GameLift Server SDK for game server integration
type GameLiftClient struct {
	cfg           *Config
	isInitialized bool
}

// NewGameLiftClient creates a new GameLift client
func NewGameLiftClient(cfg *Config) (*GameLiftClient, error) {
	return &GameLiftClient{
		cfg:           cfg,
		isInitialized: false,
	}, nil
}

// InitializeSDK initializes the GameLift Server SDK
// For managed fleets, call with no parameters
// For Anywhere fleets, provide ServerParameters
func (g *GameLiftClient) InitializeSDK(params *server.ServerParameters) error {
	var err error
	if params != nil {
		// Initialize for GameLift Anywhere with custom parameters
		err = server.InitSDK(*params)
	} else {
		// Initialize for managed EC2 or container fleets
		err = server.InitSDK(server.ServerParameters{})
	}

	if err != nil {
		log.Printf("Failed to initialize GameLift SDK: %v", err)
		return err
	}

	g.isInitialized = true
	log.Printf("GameLift SDK initialized successfully")
	return nil
}

// ProcessReady notifies GameLift that the server process is ready to host game sessions
// All callback functions must be provided, including the ones marked as "optional" in AWS docs
func (g *GameLiftClient) ProcessReady(port int, logPaths []string,
	onStartGameSession func(model.GameSession),
	onProcessTerminate func(),
	onHealthCheck func() bool,
	onUpdateGameSession func(model.UpdateGameSession)) error {

	params := server.ProcessParameters{
		Port: port,
		LogParameters: server.LogParameters{
			LogPaths: logPaths,
		},
		OnStartGameSession:  onStartGameSession,
		OnProcessTerminate:  onProcessTerminate,
		OnHealthCheck:       onHealthCheck,
		OnUpdateGameSession: onUpdateGameSession,
	}

	err := server.ProcessReady(params)
	if err != nil {
		log.Printf("Failed to notify GameLift of process ready: %v", err)
		return err
	}

	log.Printf("Server process marked as ready on port %d", port)
	return nil
}

// ActivateGameSession notifies GameLift that the game session is ready to accept players
func (g *GameLiftClient) ActivateGameSession() error {
	err := server.ActivateGameSession()
	if err != nil {
		log.Printf("Failed to activate game session: %v", err)
		return err
	}
	return nil
}

// AcceptPlayerSession validates a player session ID when a player connects
func (g *GameLiftClient) AcceptPlayerSession(playerSessionID string) error {
	err := server.AcceptPlayerSession(playerSessionID)
	if err != nil {
		log.Printf("Failed to accept player session %s: %v", playerSessionID, err)
		return err
	}
	return nil
}

// RemovePlayerSession notifies GameLift when a player disconnects
func (g *GameLiftClient) RemovePlayerSession(playerSessionID string) error {
	err := server.RemovePlayerSession(playerSessionID)
	if err != nil {
		log.Printf("Failed to remove player session %s: %v", playerSessionID, err)
		return err
	}
	return nil
}

// ProcessEnding notifies GameLift that the server process is shutting down
func (g *GameLiftClient) ProcessEnding() error {
	err := server.ProcessEnding()
	if err != nil {
		log.Printf("Failed to notify GameLift of process ending: %v", err)
		return err
	}
	log.Printf("Notified GameLift that process is ending")
	return nil
}

// Destroy cleans up the GameLift SDK resources
func (g *GameLiftClient) Destroy() {
	if g.isInitialized {
		server.Destroy()
		g.isInitialized = false
		log.Printf("GameLift SDK destroyed")
	}
}

// GetTerminationTime returns the time when GameLift will terminate the process
func (g *GameLiftClient) GetTerminationTime() (int64, error) {
	return server.GetTerminationTime()
}

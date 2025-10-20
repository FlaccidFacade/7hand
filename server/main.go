package main

import (
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"

	"github.com/FlaccidFacade/7hand/server/config"
	"github.com/FlaccidFacade/7hand/server/game"
	"github.com/FlaccidFacade/7hand/server/handlers"
)

func main() {
	// Load configuration
	cfg := config.LoadConfig()

	log.Printf("Starting 7hand Server v1.0.0")
	log.Printf("Port: %s", cfg.Port)
	log.Printf("GameFleet ID: %s", cfg.GameFleetID)
	log.Printf("Environment: %s", cfg.Environment)

	// Initialize game manager
	gameManager := game.NewManager()

	// Initialize GameLift if enabled (for production deployment)
	var gameLiftClient *config.GameLiftClient
	enableGameLift := os.Getenv("ENABLE_GAMELIFT") == "true"
	
	if enableGameLift {
		log.Printf("GameLift integration enabled")
		var err error
		gameLiftClient, err = initializeGameLift(cfg, gameManager)
		if err != nil {
			log.Fatalf("Failed to initialize GameLift: %v", err)
		}
		defer gameLiftClient.Destroy()
	} else {
		log.Printf("GameLift integration disabled (set ENABLE_GAMELIFT=true to enable)")
	}

	// Initialize WebSocket hub
	hub := handlers.NewHub(gameManager)
	go hub.Run()

	// Setup HTTP routes
	http.HandleFunc("/", handleRoot)
	http.HandleFunc("/health", handleHealth)
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		handlers.ServeWs(hub, w, r)
	})

	// Setup graceful shutdown
	go func() {
		addr := ":" + cfg.Port
		log.Printf("Server listening on %s", addr)
		if err := http.ListenAndServe(addr, nil); err != nil {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	
	// Notify GameLift of shutdown if enabled
	if gameLiftClient != nil {
		log.Println("Notifying GameLift of process shutdown...")
		if err := gameLiftClient.ProcessEnding(); err != nil {
			log.Printf("Error notifying GameLift: %v", err)
		}
	}
}

// initializeGameLift sets up the GameLift Server SDK integration
func initializeGameLift(cfg *config.Config, gameManager *game.Manager) (*config.GameLiftClient, error) {
	// Create GameLift client
	gameLiftClient, err := config.NewGameLiftClient(cfg)
	if err != nil {
		return nil, err
	}

	// Initialize SDK - for managed fleets use default, for Anywhere use custom params
	// Check if this is an Anywhere fleet (requires WebSocketURL)
	webSocketURL := os.Getenv("GAMELIFT_WEBSOCKET_URL")
	
	if webSocketURL != "" {
		// Initialize for GameLift Anywhere
		log.Printf("Initializing GameLift Anywhere with WebSocket URL")
		// Note: Additional parameters required for Anywhere fleets:
		// - GAMELIFT_PROCESS_ID
		// - GAMELIFT_HOST_ID
		// - GAMELIFT_AUTH_TOKEN or AWS credentials
		// These should be set in the environment
		// For this implementation, we'll use the default initialization
		// and document the Anywhere-specific setup separately
		err = gameLiftClient.InitializeSDK(nil)
	} else {
		// Initialize for managed EC2 or container fleets
		log.Printf("Initializing GameLift for managed fleet")
		err = gameLiftClient.InitializeSDK(nil)
	}
	
	if err != nil {
		return nil, err
	}

	// Create callback handlers
	callbacks := config.NewGameLiftCallbacks(gameManager, gameLiftClient)

	// Parse port number
	port, err := strconv.Atoi(cfg.Port)
	if err != nil {
		return nil, err
	}

	// Set up log paths (container fleets handle this automatically)
	logPaths := []string{}
	if cfg.Environment != "container" {
		// For EC2 fleets, specify log paths
		logPaths = []string{
			"/local/game/logs/server.log",
		}
	}

	// Call ProcessReady with ALL callbacks (including the "optional" ones)
	// Even though OnHealthCheck and OnUpdateGameSession are marked as "optional"
	// in AWS documentation, implementing them is critical for production:
	// - OnHealthCheck: enables GameLift to monitor server health
	// - OnUpdateGameSession: required for FlexMatch backfill
	err = gameLiftClient.ProcessReady(
		port,
		logPaths,
		callbacks.OnStartGameSession,
		callbacks.OnProcessTerminate,
		callbacks.OnHealthCheck,
		callbacks.OnUpdateGameSession,
	)
	
	if err != nil {
		return nil, err
	}

	log.Printf("GameLift integration initialized successfully")
	return gameLiftClient, nil
}

func handleRoot(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"ok","message":"7hand Server"}`))
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"healthy","service":"7hand"}`))
}

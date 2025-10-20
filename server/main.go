package main

import (
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/FlaccidFacade/seven-hand-card-game/server/config"
	"github.com/FlaccidFacade/seven-hand-card-game/server/game"
	"github.com/FlaccidFacade/seven-hand-card-game/server/handlers"
)

func main() {
	// Load configuration
	cfg := config.LoadConfig()

	log.Printf("Starting Seven Hand Card Game Server v1.0.0")
	log.Printf("Port: %s", cfg.Port)
	log.Printf("GameFleet ID: %s", cfg.GameFleetID)

	// Initialize game manager
	gameManager := game.NewManager()

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
}

func handleRoot(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"ok","message":"Seven Hand Card Game Server"}`))
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"healthy","service":"seven-hand-card-game"}`))
}

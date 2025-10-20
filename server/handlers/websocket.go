package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/FlaccidFacade/seven-hand-card-game/server/game"
	"github.com/FlaccidFacade/seven-hand-card-game/server/models"
	"github.com/gorilla/websocket"
)

const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period (must be less than pongWait)
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer
	maxMessageSize = 512 * 1024
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins for development (restrict in production)
		return true
	},
}

// Client represents a connected WebSocket client
type Client struct {
	hub      *Hub
	conn     *websocket.Conn
	send     chan []byte
	playerID string
	lobbyID  string
}

// Hub maintains active clients and broadcasts messages
type Hub struct {
	clients       map[*Client]bool
	broadcast     chan []byte
	register      chan *Client
	unregister    chan *Client
	gameManager   *game.Manager
	lobbyClients  map[string]map[*Client]bool
}

// NewHub creates a new Hub instance
func NewHub(gameManager *game.Manager) *Hub {
	return &Hub{
		clients:      make(map[*Client]bool),
		broadcast:    make(chan []byte),
		register:     make(chan *Client),
		unregister:   make(chan *Client),
		gameManager:  gameManager,
		lobbyClients: make(map[string]map[*Client]bool),
	}
}

// Run starts the hub's main loop
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
			if client.lobbyID != "" {
				if h.lobbyClients[client.lobbyID] == nil {
					h.lobbyClients[client.lobbyID] = make(map[*Client]bool)
				}
				h.lobbyClients[client.lobbyID][client] = true
			}
			log.Printf("Client registered: player=%s lobby=%s", client.playerID, client.lobbyID)

		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				
				// Remove from lobby clients
				if client.lobbyID != "" {
					if clients, ok := h.lobbyClients[client.lobbyID]; ok {
						delete(clients, client)
						if len(clients) == 0 {
							delete(h.lobbyClients, client.lobbyID)
						}
					}
					
					// Remove player from lobby
					h.gameManager.LeaveLobby(client.lobbyID, client.playerID)
				}
				
				log.Printf("Client unregistered: player=%s lobby=%s", client.playerID, client.lobbyID)
			}

		case message := <-h.broadcast:
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
		}
	}
}

// BroadcastToLobby sends a message to all clients in a specific lobby
func (h *Hub) BroadcastToLobby(lobbyID string, message []byte) {
	if clients, ok := h.lobbyClients[lobbyID]; ok {
		for client := range clients {
			select {
			case client.send <- message:
			default:
				close(client.send)
				delete(h.clients, client)
				delete(clients, client)
			}
		}
	}
}

// readPump pumps messages from the WebSocket connection to the hub
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})
	c.conn.SetReadLimit(maxMessageSize)

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Handle incoming message
		c.handleMessage(message)
	}
}

// writePump pumps messages from the hub to the WebSocket connection
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued messages to the current websocket message
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ServeWs handles WebSocket requests from clients
func ServeWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	client := &Client{
		hub:  hub,
		conn: conn,
		send: make(chan []byte, 256),
	}

	hub.register <- client

	// Start goroutines for reading and writing
	go client.writePump()
	go client.readPump()
}

// handleMessage processes incoming WebSocket messages
func (c *Client) handleMessage(message []byte) {
	var msg Message
	if err := json.Unmarshal(message, &msg); err != nil {
		log.Printf("Error unmarshaling message: %v", err)
		c.sendError("Invalid message format")
		return
	}

	log.Printf("Received message: type=%s from player=%s", msg.Type, c.playerID)

	switch msg.Type {
	case "connect":
		c.handleConnect(msg)
	case "create_lobby":
		c.handleCreateLobby(msg)
	case "join_lobby":
		c.handleJoinLobby(msg)
	case "leave_lobby":
		c.handleLeaveLobby(msg)
	case "start_game":
		c.handleStartGame(msg)
	case "play_card":
		c.handlePlayCard(msg)
	default:
		c.sendError("Unknown message type")
	}
}

// handleConnect processes player connection
func (c *Client) handleConnect(msg Message) {
	var data struct {
		PlayerID   string `json:"playerId"`
		PlayerName string `json:"playerName"`
	}
	
	if err := json.Unmarshal(msg.Data, &data); err != nil {
		c.sendError("Invalid connect data")
		return
	}
	
	c.playerID = data.PlayerID
	
	response := Message{
		Type: "connected",
		Data: json.RawMessage(`{"status":"ok"}`),
	}
	c.sendMessage(response)
}

// handleCreateLobby creates a new game lobby
func (c *Client) handleCreateLobby(msg Message) {
	var data struct {
		PlayerName string `json:"playerName"`
	}
	
	if err := json.Unmarshal(msg.Data, &data); err != nil {
		c.sendError("Invalid lobby creation data")
		return
	}
	
	player := models.NewPlayer(c.playerID, data.PlayerName)
	lobby := c.hub.gameManager.CreateLobby(player)
	c.lobbyID = lobby.ID
	
	// Register client with lobby
	if c.hub.lobbyClients[c.lobbyID] == nil {
		c.hub.lobbyClients[c.lobbyID] = make(map[*Client]bool)
	}
	c.hub.lobbyClients[c.lobbyID][c] = true
	
	responseData, _ := json.Marshal(map[string]interface{}{
		"lobbyId": lobby.ID,
		"lobby":   lobby,
	})
	
	response := Message{
		Type: "lobby_created",
		Data: responseData,
	}
	c.sendMessage(response)
}

// handleJoinLobby joins an existing lobby
func (c *Client) handleJoinLobby(msg Message) {
	var data struct {
		LobbyID    string `json:"lobbyId"`
		PlayerName string `json:"playerName"`
	}
	
	if err := json.Unmarshal(msg.Data, &data); err != nil {
		c.sendError("Invalid join data")
		return
	}
	
	player := models.NewPlayer(c.playerID, data.PlayerName)
	lobby, success := c.hub.gameManager.JoinLobby(data.LobbyID, player)
	
	if !success {
		c.sendError("Failed to join lobby")
		return
	}
	
	c.lobbyID = data.LobbyID
	
	// Register client with lobby
	if c.hub.lobbyClients[c.lobbyID] == nil {
		c.hub.lobbyClients[c.lobbyID] = make(map[*Client]bool)
	}
	c.hub.lobbyClients[c.lobbyID][c] = true
	
	// Broadcast to all lobby members
	responseData, _ := json.Marshal(map[string]interface{}{
		"lobbyId": lobby.ID,
		"lobby":   lobby,
		"player":  player,
	})
	
	response := Message{
		Type: "player_joined",
		Data: responseData,
	}
	
	broadcastData, _ := json.Marshal(response)
	c.hub.BroadcastToLobby(c.lobbyID, broadcastData)
}

// handleLeaveLobby removes player from lobby
func (c *Client) handleLeaveLobby(msg Message) {
	if c.lobbyID == "" {
		c.sendError("Not in a lobby")
		return
	}
	
	lobbyID := c.lobbyID
	c.hub.gameManager.LeaveLobby(lobbyID, c.playerID)
	c.lobbyID = ""
	
	// Notify other players
	responseData, _ := json.Marshal(map[string]interface{}{
		"playerId": c.playerID,
	})
	
	response := Message{
		Type: "player_left",
		Data: responseData,
	}
	
	broadcastData, _ := json.Marshal(response)
	c.hub.BroadcastToLobby(lobbyID, broadcastData)
}

// handleStartGame starts the game
func (c *Client) handleStartGame(msg Message) {
	if c.lobbyID == "" {
		c.sendError("Not in a lobby")
		return
	}
	
	lobby, success := c.hub.gameManager.StartGame(c.lobbyID)
	if !success {
		c.sendError("Failed to start game")
		return
	}
	
	responseData, _ := json.Marshal(map[string]interface{}{
		"lobby": lobby,
	})
	
	response := Message{
		Type: "game_started",
		Data: responseData,
	}
	
	broadcastData, _ := json.Marshal(response)
	c.hub.BroadcastToLobby(c.lobbyID, broadcastData)
}

// handlePlayCard processes a card play action
func (c *Client) handlePlayCard(msg Message) {
	// Placeholder for card playing logic
	log.Printf("Play card action from player %s in lobby %s", c.playerID, c.lobbyID)
	
	// TODO: Implement actual card game logic
	responseData, _ := json.Marshal(map[string]interface{}{
		"status": "card_played",
	})
	
	response := Message{
		Type: "card_played",
		Data: responseData,
	}
	
	broadcastData, _ := json.Marshal(response)
	c.hub.BroadcastToLobby(c.lobbyID, broadcastData)
}

// sendMessage sends a message to the client
func (c *Client) sendMessage(msg Message) {
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}
	
	select {
	case c.send <- data:
	default:
		log.Printf("Client send buffer full")
	}
}

// sendError sends an error message to the client
func (c *Client) sendError(errorMsg string) {
	errorData, _ := json.Marshal(map[string]string{"error": errorMsg})
	response := Message{
		Type: "error",
		Data: errorData,
	}
	c.sendMessage(response)
}

// Message represents a WebSocket message
type Message struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

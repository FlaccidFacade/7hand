package config

import (
	"os"
)

// Config holds the application configuration
type Config struct {
	Port        string
	GameFleetID string
	AWSRegion   string
	Environment string
}

// LoadConfig loads configuration from environment variables
func LoadConfig() *Config {
	return &Config{
		Port:        getEnv("PORT", "8080"),
		GameFleetID: getEnv("GAME_FLEET_ID", "local-fleet"),
		AWSRegion:   getEnv("AWS_REGION", "us-east-1"),
		Environment: getEnv("ENVIRONMENT", "development"),
	}
}

// getEnv retrieves an environment variable or returns a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

# 7hand Nginx Reverse Proxy

This directory contains the nginx reverse proxy configuration for the 7hand card game application, designed for EC2 deployment.

## Purpose

The nginx proxy serves as the main entry point for all traffic in production deployments, providing:

- **Unified routing**: Single endpoint (port 8000) for both frontend and backend services
- **Rate limiting**: Protection against excessive API calls and game requests
- **WebSocket support**: Real-time multiplayer game features
- **Health checks**: EC2 load balancer integration via `/health` endpoint
- **Compression**: Optimized delivery of game assets and API responses
- **Load balancing**: Ready for horizontal scaling of backend services

## Architecture

```
Client → nginx-proxy:8000 → frontend:80 (Angular SPA)
                          → backend:3000 (Express API)
```

## Configuration

- `sevenhand.conf`: Main nginx configuration with upstream definitions and routing rules
- `Dockerfile`: Container definition for the proxy service

## Usage

### Local Development

The proxy is included in `docker-compose.yml`:

```bash
docker compose up sevenhand-proxy frontend backend db
```

Access the application at: `http://localhost:8000`

### Production Deployment

The proxy image is built and pushed to AWS ECR via the GitHub Actions workflow.

## Endpoints

- `/` - Routes to Angular frontend
- `/api/*` - Routes to Express backend with rate limiting (30 req/s)
- `/health` - Health check for load balancers (returns 200 OK)

## Rate Limits

- API requests: 30 requests/second (burst: 10)
- Frontend requests: 60 requests/second (burst: 20)

## Logs

- Access log: `/var/log/nginx/sevenhand_access.log`
- Error log: `/var/log/nginx/sevenhand_error.log`

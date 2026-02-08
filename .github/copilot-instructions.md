# GitHub Copilot Instructions for 7hand

## Project Overview

7hand is a multiplayer card game (rummy variation) featuring 7 hands per game. The project is a full-stack monorepo with Angular frontend, Node.js/Express backend, PostgreSQL database, and Docker-based deployment.

**Key Features:**
- Real-time multiplayer card game
- User management with activity tracking and statistics
- Lobby system for game sessions
- Profanity filtering for usernames and display names
- PostgreSQL database with migrations
- Docker Compose development environment
- AWS EC2 production deployment with Nginx proxy

## Tech Stack

### Frontend
- **Framework:** Angular 21+ (TypeScript 5.9+)
- **Testing:** Jasmine + Karma
- **Build:** Angular CLI
- **Package Manager:** npm

### Backend
- **Runtime:** Node.js 20+ with Express 5+
- **Database:** PostgreSQL 16
- **ORM:** Raw SQL with pg library
- **Testing:** Jest
- **Migrations:** node-pg-migrate
- **Logging:** Winston

### Infrastructure
- **Containerization:** Docker + Docker Compose
- **Proxy:** Nginx (production)
- **CI/CD:** GitHub Actions
- **Deployment:** AWS EC2
- **Testing:** Selenium (E2E)

## Project Structure

```
7hand/
├── frontend/                 # Angular application
│   ├── src/app/
│   │   ├── components/      # Reusable UI components
│   │   ├── services/        # Business logic and API services
│   │   └── app.routes.ts    # Route configuration
│   ├── package.json
│   └── angular.json
├── backend/                  # Node.js Express API
│   ├── __tests__/           # Jest tests
│   ├── routes/              # API route handlers
│   ├── migrations/          # Database migrations
│   ├── user.js              # User model and manager
│   ├── lobby.js             # Lobby/game session management
│   ├── profanity-filter.js  # Content moderation
│   ├── db.js                # Database connection
│   └── index.js             # Main server file
├── nginx-proxy/             # Nginx reverse proxy config
├── selenium/                # E2E tests
├── .github/
│   ├── workflows/           # CI/CD pipelines
│   └── copilot-instructions.md  # This file
└── docker-compose.yml       # Service orchestration
```

## Coding Standards and Conventions

### General Principles
- **Write clear, maintainable code** - Prioritize readability over cleverness
- **Follow existing patterns** - Match the style and structure of existing code
- **Test your changes** - All new features require tests
- **Document non-obvious logic** - Use inline comments sparingly but effectively
- **Security first** - Validate all inputs, prevent SQL injection, avoid exposing sensitive data

### JavaScript/TypeScript
- **Style:** Prettier configuration in `.prettierrc`
- **Use modern ES6+ syntax** - const/let, arrow functions, async/await
- **TypeScript strict mode** - Frontend uses strict type checking
- **Error Handling:** Always use try/catch for async operations
- **Naming:**
  - camelCase for variables and functions
  - PascalCase for classes and components
  - UPPER_SNAKE_CASE for constants

### Database
- **Migrations:** All schema changes via `backend/migrations/`
- **Parameterized Queries:** Always use `$1, $2` placeholders to prevent SQL injection
- **Transactions:** Use for multi-step operations
- **Indexing:** Add indexes for frequently queried columns

### API Design
- **RESTful conventions:** Use standard HTTP methods and status codes
- **Versioning:** Prefix routes with `/api/`
- **Validation:** Validate all inputs on the backend
- **Error responses:** Return consistent JSON error format
- **Generic error messages:** Don't expose internal details or slurs to clients

### Content Moderation
- **Backend is authoritative** - All profanity validation happens server-side
- **Frontend mirrors backend** - Client-side validation provides immediate feedback
- **Generic error messages** - Never reveal which specific prohibited term was detected
- **See PROFANITY_FILTER.md** for detailed implementation

## Development Workflow

### Setting Up Development Environment

```bash
# Start development services
docker compose up frontend-dev backend db

# Work in container (recommended)
code frontend  # Then select 'Reopen in Container'

# Access services
# Frontend: http://localhost:4200
# Backend API: http://localhost:3000
```

### Running Tests

**Frontend:**
```bash
cd frontend
npm test              # Run all tests with watch
npm run test:unit     # Unit tests only
npm run test:ci       # CI mode (no watch)
```

**Backend:**
```bash
cd backend
npm test              # Run all tests
npm test -- user.test.js  # Run specific test file
```

**Database Migrations:**
```bash
cd backend
npm run migrate       # Run migrations
npm run migrate-down  # Rollback migration
```

### Linting and Building

**Frontend:**
```bash
cd frontend
npm run build         # Production build
npm run watch         # Development build with watch
```

**Backend:**
- No explicit build step (Node.js runtime)
- Linting handled by CI/CD

## Testing Requirements

### Test Coverage Expectations
- **Unit tests:** All business logic (User, Lobby, profanity filter)
- **Integration tests:** API endpoints, database operations
- **E2E tests:** Critical user flows (Selenium)

### Writing Tests
- **Follow existing patterns** - Check `__tests__/` directories for examples
- **Use descriptive test names** - `it('should reject username with profanity')`
- **Test edge cases** - Empty strings, null values, boundary conditions
- **Mock external dependencies** - Database, HTTP requests
- **Clean up test data** - Use beforeEach/afterEach hooks

### Running Specific Tests
```bash
# Backend - Jest
npm test -- --testNamePattern="User validation"
npm test -- user.test.js

# Frontend - Karma
npm test -- --include='**/user.service.spec.ts'
```

## Security Considerations

### Input Validation
- **Never trust user input** - Validate on backend always
- **Sanitize all inputs** - Prevent XSS, SQL injection
- **Use parameterized queries** - Never string concatenation for SQL
- **Validate email format** - Use proven regex patterns (avoid ReDoS)

### Data Protection
- **Don't log sensitive data** - Usernames with profanity, passwords, emails
- **Use .toSafeObject()** - Remove sensitive fields before sending to client
- **Environment variables** - Store secrets in .env (never commit)
- **HTTPS only in production** - Enforce secure connections

### Authentication & Authorization (Future)
- Currently no authentication system
- When implementing: use bcrypt for passwords, JWT for sessions
- See IMPLEMENTATION_SUMMARY.md for planned enhancements

## Database Schema

### Key Tables
- **users** - User accounts with stats and activity tracking
  - Unique username constraint
  - JSONB stats field
  - Activity timestamps
  - Indexes on username, last_active
  
- **lobbies** - Game session management
  - Created from `backend/lobbies.sql`
  - Links to users table

### Making Schema Changes
1. Create migration: `backend/migrations/XXX_description.js`
2. Test migration locally: `npm run migrate`
3. Verify in PostgreSQL: `\d table_name`
4. Update models to reflect schema
5. Add tests for new schema

## API Endpoints

### User Management
- `POST /api/user` - Create user
- `GET /api/user/:userId` - Get user by ID
- `GET /api/user/username/:username` - Get user by username
- `GET /api/users` - List all users
- `PATCH /api/user/:userId` - Update user
- `DELETE /api/user/:userId` - Delete user
- `POST /api/user/:userId/activity` - Update activity timestamp

### Lobby Management
- `POST /api/lobby` - Create lobby (requires userId)
- `POST /api/lobby/:lobbyId/join` - Join lobby (requires userId)
- See `backend/lobby.js` for full API

### Configuration
- `GET /api/config/profanity-rules` - Get profanity filter rules
- `GET /health` - Health check endpoint

## CI/CD Pipeline

### GitHub Actions Workflows
- **backend-ci.yml** - Backend tests with PostgreSQL
- **front-end-ci.yml** - Frontend tests with Angular
- **selenium-ci.yml** - E2E tests
- **aws-publish.yml** - Production deployment
- **auto-merge-dependabot.yml** - Automated dependency updates
- **auto-delete-branch.yml** - Branch cleanup

### CI Requirements
- All tests must pass
- Migrations must run successfully
- No lint errors
- Build must complete

## Common Tasks

### Adding a New API Endpoint
1. Add route in `backend/index.js` or `backend/routes/`
2. Implement handler with validation
3. Add tests in `backend/__tests__/`
4. Update this documentation if needed

### Adding a New Frontend Component
1. Create component in `frontend/src/app/components/`
2. Include `.ts`, `.html`, `.css`, and `.spec.ts` files
3. Register in app.routes.ts if routable
4. Write Jasmine tests
5. Follow Angular style guide

### Adding a Database Migration
1. Create `backend/migrations/XXX_description.js`
2. Implement `up` and `down` functions
3. Test locally: `npm run migrate` then `npm run migrate-down`
4. Update model classes
5. Add database tests

### Updating Profanity Filter
1. Edit `backend/slur-list.js`
2. Add terms and/or regex patterns
3. Run tests: `npm test profanity-filter.test.js`
4. Frontend auto-fetches updated rules

## Documentation References

- **README.md** - Getting started and quick start guide
- **IMPLEMENTATION_SUMMARY.md** - User object implementation details
- **PROFANITY_FILTER.md** - Content moderation system
- **backend/USER_DOCUMENTATION.md** - User API documentation
- **backend/README.md** - Backend API reference

## Best Practices for AI-Assisted Development

### When Generating Code
- **Review existing code first** - Match established patterns
- **Start with tests** - Write tests before implementation when possible
- **Make minimal changes** - Don't refactor unrelated code
- **Follow the style guide** - Use Prettier, match naming conventions
- **Add appropriate logging** - Use Winston logger in backend

### When Making Changes
- **Run tests frequently** - Catch issues early
- **Test edge cases** - Null, undefined, empty strings, boundary values
- **Consider security** - Validate inputs, prevent injection
- **Check profanity filter** - For any user-facing text input
- **Update documentation** - Keep docs in sync with code

### When Adding Dependencies
- **Check existing dependencies first** - Avoid duplicates
- **Prefer established packages** - Check npm downloads and maintenance
- **Update package.json** - Document why dependency was added
- **Test thoroughly** - New dependencies can introduce vulnerabilities
- **Run security audit** - `npm audit` before committing

## Deployment

### Development
```bash
docker compose up frontend-dev backend db
```

### Production
```bash
docker compose up sevenhand-proxy frontend backend db
# Access at http://localhost:8000
# Health check at http://localhost:8000/health
```

### AWS EC2
- Uses Nginx reverse proxy
- Rate limiting and WebSocket support
- See `nginx-proxy/` for configuration
- Deployed via `aws-publish.yml` workflow

## Environment Variables

**Backend (PostgreSQL):**
- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 5432)
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `DB_NAME` - Database name
- `DATABASE_URL` - Full connection string (alternative)

**Never commit these values** - Use environment-specific configuration

## Key Design Decisions

1. **Backend as source of truth** - All validation happens server-side
2. **RESTful API design** - Standard HTTP methods and status codes
3. **PostgreSQL for persistence** - Relational data with ACID guarantees
4. **In-memory caching** - UserManager maintains active users in memory
5. **Generic error messages** - Security through obscurity for profanity filter
6. **Docker for consistency** - Same environment dev to prod
7. **Migrations for schema** - Version-controlled database changes
8. **JWT-free for now** - Authentication planned for future

## Future Enhancements (Planned)

See IMPLEMENTATION_SUMMARY.md for detailed roadmap:
- Authentication with bcrypt password hashing
- User roles and permissions
- Profile pictures/avatars
- Friends system and social features
- Achievement tracking
- ELO/rating system
- Session management
- Account recovery

## Getting Help

- **Check documentation** - README.md, IMPLEMENTATION_SUMMARY.md, PROFANITY_FILTER.md
- **Review tests** - `__tests__/` directories have usage examples
- **Check existing code** - Similar features provide patterns to follow
- **Open an issue** - For bugs or feature requests on GitHub

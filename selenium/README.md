# Selenium Multi-Browser Testing Setup

This directory contains a complete Selenium Grid setup for testing the Seven Hand Card Game title across multiple browser types (Chrome and Firefox).

## Files

- `Dockerfile` - Docker image for running Selenium tests
- `package.json` - Node.js dependencies and test scripts
- `test.js` - Original test (Chrome only)
- `test-grid.js` - Multi-browser test with embedded HTTP server
- `test-local.js` - Test with local HTML file
- `test-standalone.js` - Standalone test for development
- `test-page.html` - Simple HTML test page

## Test Scripts

### Available Scripts

- `npm test` - Run the original Chrome-only test
- `npm run test:grid` - Run multi-browser tests with embedded server
- `npm run test:local` - Test with local HTML file
- `npm run test:standalone` - Standalone Chrome test

### Multi-Browser Testing

The main multi-browser test (`test-grid.js`) tests both Chrome and Firefox browsers by:

1. Starting an embedded HTTP server serving a test page with title "7-hand"
2. Connecting to Selenium Grid Hub
3. Running tests against both Chrome and Firefox nodes
4. Verifying that the page title contains "7-hand"
5. Reporting results for each browser

## Docker Compose Integration

The parent `docker-compose.yml` includes:

- `selenium-hub` - Selenium Grid Hub
- `selenium-chrome` - Chrome browser node
- `selenium-firefox` - Firefox browser node
- `selenium-tests` - Test runner container

## Running Tests

### With Docker Compose

```bash
# Start Selenium Grid
docker compose up selenium-hub selenium-chrome selenium-firefox -d

# Run tests
docker compose up selenium-tests
```

### Locally (with local Selenium Grid)

```bash
# Install dependencies
npm install

# Run multi-browser tests
SELENIUM_REMOTE_URL=http://localhost:4444/wd/hub npm run test:grid
```

## Expected Output

Successful test run shows:
```
Starting cross-browser title tests...
Selenium Grid URL: http://selenium-hub:4444/wd/hub

=== Testing CHROME browser ===
✓ Page title in chrome: "7-hand"
✓ SUCCESS: Title verification passed for chrome

=== Testing FIREFOX browser ===
✓ Page title in firefox: "7-hand"
✓ SUCCESS: Title verification passed for firefox

=== Test Summary ===
✓ All browser tests passed successfully!
```

## Configuration

Environment variables:
- `SELENIUM_REMOTE_URL` - Selenium Grid Hub URL (default: http://localhost:4444/wd/hub)
- `FRONTEND_URL` - URL of the application to test (for integration with actual frontend)

### CI Environment Configuration

For Continuous Integration environments, browsers are configured to run in offline mode to prevent external network calls:

#### Chrome Configuration
- `--no-sandbox` - Required for containerized environments
- `--disable-dev-shm-usage` - Prevents /dev/shm exhaustion
- `--disable-background-networking` - Prevents telemetry calls
- `--disable-default-apps`, `--disable-extensions`, `--disable-sync` - Disables unnecessary features
- `--disable-translate` - Prevents Google Translate API calls
- `--no-first-run` - Skips first-run setup
- `--disable-component-update` - Prevents component update checks
- `--disable-domain-reliability` - Disables domain reliability service
- `--disable-client-side-phishing-detection` - Disables phishing detection service

#### Firefox Configuration
- `--no-remote` - Prevents external connections
- Disabled preferences:
  - Safe browsing features
  - Telemetry and health reporting
  - Automatic updates
  - DNS prefetching and speculative connections

These configurations ensure browsers run reliably in CI environments without attempting external network connections that may be blocked by firewalls.

## Browser Support

Currently supports:
- ✅ Chrome
- ✅ Firefox
- 🔄 Additional browsers can be added by updating the `browsers` array in test files

## Integration Notes

This setup can be extended to test the actual Seven Hand Card Game frontend by:
1. Ensuring the frontend service is running
2. Updating the `FRONTEND_URL` environment variable
3. Modifying test assertions as needed for the actual application
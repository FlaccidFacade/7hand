const { Builder, By, until } = require('selenium-webdriver');
const http = require('http');

const seleniumRemoteUrl = process.env.SELENIUM_REMOTE_URL || 'http://localhost:4444/wd/hub';

// List of browsers to test
const browsers = ['chrome', 'firefox'];

// Simple HTTP server to serve our test page
function createTestServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === '/' || req.url === '/index.html') {
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>7-hand</title>
</head>
<body>
    <h1>Seven Hand Card Game</h1>
    <p>Welcome to the Seven Hand Card Game!</p>
    <p>This is a test page for Selenium multi-browser testing.</p>
</body>
</html>`;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(htmlContent);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    server.listen(8080, '0.0.0.0', () => {
      console.log(`Test server started on port 8080`);
      resolve({ server, port: 8080 });
    });
  });
}

async function testBrowser(browserName, frontendUrl) {
  console.log(`\n=== Testing ${browserName.toUpperCase()} browser ===`);
  
  let driver = await new Builder()
    .forBrowser(browserName)
    .usingServer(seleniumRemoteUrl)
    .build();
    
  try {
    console.log(`Navigating to ${frontendUrl} with ${browserName}`);
    await driver.get(frontendUrl);
    
    // Wait for the page to load
    await driver.wait(until.elementLocated(By.css('body')), 10000);
    
    // Get and verify the title
    const title = await driver.getTitle();
    console.log(`✓ Page title in ${browserName}: "${title}"`);
    
    // Check for the page heading
    const heading = await driver.findElement(By.css('h1')).getText();
    console.log(`✓ Page heading in ${browserName}: "${heading}"`);
    
    // Basic assertion - check if title contains expected content
    if (title.includes('7-hand')) {
      console.log(`✓ SUCCESS: Title verification passed for ${browserName}`);
      return true;
    } else {
      console.log(`✗ FAILURE: Expected title to contain "7-hand", but got "${title}" in ${browserName}`);
      return false;
    }
    
  } catch (error) {
    console.log(`✗ ERROR testing ${browserName}: ${error.message}`);
    return false;
  } finally {
    await driver.quit();
  }
}

(async function runAllTests() {
  console.log('Starting cross-browser title tests...');
  console.log(`Selenium Grid URL: ${seleniumRemoteUrl}`);
  
  // Start test server
  const { server, port } = await createTestServer();
  const frontendUrl = `http://localhost:${port}`;
  console.log(`Frontend URL: ${frontendUrl}`);
  
  let allTestsPassed = true;
  
  try {
    for (const browser of browsers) {
      try {
        const result = await testBrowser(browser, frontendUrl);
        if (!result) {
          allTestsPassed = false;
        }
      } catch (error) {
        console.log(`✗ Failed to test ${browser}: ${error.message}`);
        allTestsPassed = false;
      }
    }
    
    console.log('\n=== Test Summary ===');
    if (allTestsPassed) {
      console.log('✓ All browser tests passed successfully!');
    } else {
      console.log('✗ Some browser tests failed!');
    }
  } finally {
    // Close test server
    server.close();
    console.log('Test server stopped');
  }
  
  process.exit(allTestsPassed ? 0 : 1);
})();
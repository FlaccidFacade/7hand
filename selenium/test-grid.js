const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const firefox = require('selenium-webdriver/firefox');
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
  
  let builder = new Builder();
  
  // Configure browser-specific options for CI environment
  if (browserName === 'chrome') {
    const chromeOptions = new chrome.Options();
    chromeOptions.addArguments([
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--disable-translate',
      '--no-first-run',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-features=TranslateUI,BlinkGenPropertyTrees,VizDisplayCompositor',
      '--disable-component-update',
      '--disable-domain-reliability',
      '--disable-client-side-phishing-detection'
    ]);
    builder = builder.forBrowser('chrome').setChromeOptions(chromeOptions);
  } else if (browserName === 'firefox') {
    const firefoxOptions = new firefox.Options();
    firefoxOptions.addArguments([
      '--no-remote'
    ]);
    // Disable various Firefox features that try to connect externally
    firefoxOptions.setPreference('network.dns.disableIPv6', true);
    firefoxOptions.setPreference('network.prefetch-next', false);
    firefoxOptions.setPreference('network.http.speculative-parallel-limit', 0);
    firefoxOptions.setPreference('dom.ipc.plugins.enabled.libflashplayer.so', false);
    firefoxOptions.setPreference('browser.safebrowsing.enabled', false);
    firefoxOptions.setPreference('browser.safebrowsing.malware.enabled', false);
    firefoxOptions.setPreference('browser.safebrowsing.phishing.enabled', false);
    firefoxOptions.setPreference('browser.search.update', false);
    firefoxOptions.setPreference('app.update.enabled', false);
    firefoxOptions.setPreference('toolkit.telemetry.enabled', false);
    firefoxOptions.setPreference('datareporting.policy.dataSubmissionEnabled', false);
    firefoxOptions.setPreference('datareporting.healthreport.service.enabled', false);
    firefoxOptions.setPreference('datareporting.healthreport.uploadEnabled', false);
    builder = builder.forBrowser('firefox').setFirefoxOptions(firefoxOptions);
  } else {
    builder = builder.forBrowser(browserName);
  }
  
  let driver = await builder.usingServer(seleniumRemoteUrl).build();
    
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
  // Use the container name that other containers can reach
  const frontendUrl = `http://selenium-tests:${port}`;
  console.log(`Frontend URL: ${frontendUrl}`);
  
  let allTestsPassed = true;
  const testResults = {};
  
  try {
    for (const browser of browsers) {
      try {
        const result = await testBrowser(browser, frontendUrl);
        testResults[browser] = result;
        if (!result) {
          allTestsPassed = false;
        }
      } catch (error) {
        console.log(`✗ Failed to test ${browser}: ${error.message}`);
        testResults[browser] = false;
        allTestsPassed = false;
      }
    }
    
    console.log('\n=== Test Summary ===');
    console.log('Browser test results:');
    for (const [browser, passed] of Object.entries(testResults)) {
      console.log(`  ${browser}: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
    }
    
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
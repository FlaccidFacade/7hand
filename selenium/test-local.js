const { Builder, By, until } = require('selenium-webdriver');
const path = require('path');

const seleniumRemoteUrl = process.env.SELENIUM_REMOTE_URL || 'http://localhost:4444/wd/hub';
const htmlFile = path.resolve(__dirname, 'test-page.html');
const frontendUrl = process.env.FRONTEND_URL || `file://${htmlFile}`;

// List of browsers to test
const browsers = ['chrome', 'firefox'];

async function testBrowser(browserName) {
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
  console.log(`Frontend URL: ${frontendUrl}`);
  
  let allTestsPassed = true;
  
  for (const browser of browsers) {
    try {
      const result = await testBrowser(browser);
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
    process.exit(0);
  } else {
    console.log('✗ Some browser tests failed!');
    process.exit(1);
  }
})();
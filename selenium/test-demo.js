const { Builder, By, until } = require('selenium-webdriver');

const seleniumRemoteUrl = process.env.SELENIUM_REMOTE_URL || 'http://localhost:4444/wd/hub';

// List of browsers to test
const browsers = ['chrome', 'firefox'];

async function testBrowser(browserName) {
  console.log(`\n=== Testing ${browserName.toUpperCase()} browser ===`);
  
  let driver = await new Builder()
    .forBrowser(browserName)
    .usingServer(seleniumRemoteUrl)
    .build();
    
  try {
    // Test with a simple data URL that has our expected title
    const testUrl = 'data:text/html,<html><head><title>7-hand Test Page</title></head><body><h1>Seven Hand Card Game</h1><p>Multi-browser test successful!</p></body></html>';
    
    console.log(`Testing data URL with ${browserName}`);
    await driver.get(testUrl);
    
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
  console.log('Testing with embedded HTML data URL');
  
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
    console.log('✓ Multi-browser Selenium testing is working correctly!');
    process.exit(0);
  } else {
    console.log('✗ Some browser tests failed!');
    process.exit(1);
  }
})();
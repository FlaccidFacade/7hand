const { Builder, By, until } = require('selenium-webdriver');

// Standalone test for local development
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';

async function testStandalone() {
  console.log('Running standalone browser test...');
  console.log(`Frontend URL: ${frontendUrl}`);
  
  let driver = await new Builder()
    .forBrowser('chrome')
    .build();
    
  try {
    console.log('Navigating to frontend...');
    await driver.get(frontendUrl);
    
    // Wait for the page to load
    await driver.wait(until.elementLocated(By.css('body')), 10000);
    
    // Get and verify the title
    const title = await driver.getTitle();
    console.log(`✓ Page title: "${title}"`);
    
    // Basic assertion - check if title contains expected content
    if (title.includes('7-hand')) {
      console.log(`✓ SUCCESS: Title verification passed`);
      return true;
    } else {
      console.log(`✗ FAILURE: Expected title to contain "7-hand", but got "${title}"`);
      return false;
    }
    
  } catch (error) {
    console.log(`✗ ERROR: ${error.message}`);
    return false;
  } finally {
    await driver.quit();
  }
}

if (require.main === module) {
  testStandalone()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testStandalone };
const { Builder, By, until } = require('selenium-webdriver');

const seleniumRemoteUrl = process.env.SELENIUM_REMOTE_URL || 'http://localhost:4444/wd/hub';
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';

(async function runTest() {
  let driver = await new Builder()
    .forBrowser('chrome')
    .usingServer(seleniumRemoteUrl)
    .build();
  try {
    await driver.get(frontendUrl);
    await driver.wait(until.elementLocated(By.css('body')), 10000);
    const title = await driver.getTitle();
    console.log('Page title is:', title);
  } finally {
    await driver.quit();
  }
})();

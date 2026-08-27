const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Tell Puppeteer to store and find its browser cache inside project folder
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};

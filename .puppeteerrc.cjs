const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Tell Puppeteer to store and find its browser cache inside backend/.cache
  cacheDirectory: join(__dirname, 'backend', '.cache', 'puppeteer'),
};

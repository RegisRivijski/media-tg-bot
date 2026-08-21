const fs = require('fs');
const path = require('path');

const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'),
);

module.exports = {
  application: {
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
  },
  bot: {
    apiToken: process.env.MEDIA_TG_BOT_API_TOKEN,
  },
  telegramBotApi: {
    protocol: process.env.TELEGRAM_BOT_API_PROTOCOL || 'http:',
    host: process.env.TELEGRAM_BOT_API_HOST,
    port: process.env.TELEGRAM_BOT_API_PORT,
  },
};

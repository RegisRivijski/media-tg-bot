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
    protocol: process.env.TELEGRAM_BOT_API_PROTOCOL,
    host: process.env.TELEGRAM_BOT_API_HOST,
    port: process.env.TELEGRAM_BOT_API_PORT,
  },
  analytics: {
    umami: {
      host: process.env.UMAMI_HOST,
      websiteId: process.env.UMAMI_WEBSITE_ID_MEDIA,
      hostname: 'brainrot-adapter',
    },
  },
};

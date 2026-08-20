const mainController = require('../controllers/mainController');
const mediaController = require('../controllers/mediaController');

function registerRoutes(bot) {
  bot.start(mainController.start);
  bot.command('help', mainController.help);
  bot.on('callback_query', mediaController.onCallback);
  bot.on('message', mediaController.onMessage);
}

module.exports = {
  registerRoutes,
};

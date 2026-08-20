const { Telegraf } = require('telegraf');

const config = require('../config/default');
const errorsHandler = require('./middlewares/errorsHandler');
const { registerRoutes } = require('./routes');
const { registerBotCommands } = require('./helpers/telegramCommandsHelper');

function buildTelegramApiRoot() {
  if (!config.telegramBotApi.host || !config.telegramBotApi.port) {
    return undefined;
  }
  return `${config.telegramBotApi.protocol}//${config.telegramBotApi.host}:${config.telegramBotApi.port}`;
}

function createBot(apiRoot) {
  return new Telegraf(config.bot.apiToken, apiRoot ? { telegram: { apiRoot } } : {});
}

function printStartupTable(apiRoot) {
  console.table({
    Application: config.application.name,
    Version: config.application.version,
    LocalApi: Boolean(apiRoot),
    YtDlp: config.download.ytdlpBin,
    MaxFilesizeMb: Math.round(config.download.maxFilesize / (1024 * 1024)),
    DefaultHeight: config.download.defaultHeight,
  });
}

function listenForShutdown(bot) {
  const shutdown = (signal) => {
    bot.stop(signal);
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

async function main() {
  if (!config.bot.apiToken) {
    throw new Error('MEDIA_TG_BOT_API_TOKEN is required');
  }

  const apiRoot = buildTelegramApiRoot();
  const bot = createBot(apiRoot);

  bot.use(errorsHandler);
  registerRoutes(bot);
  bot.catch((error) => {
    console.error('[telegraf]', error.code || error.message);
  });

  await bot.launch({
    allowedUpdates: ['message', 'callback_query'],
  });
  await registerBotCommands(bot).catch((error) => {
    console.warn('[telegram] setMyCommands failed:', error.message);
  });

  printStartupTable(apiRoot);
  listenForShutdown(bot);

  return bot;
}

module.exports = main;

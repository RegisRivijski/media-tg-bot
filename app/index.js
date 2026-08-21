const { Telegraf } = require('telegraf');

const config = require('../config/default');
const { DEFAULT_HEIGHT, LIMIT_RATE_BYTES, MAX_FILESIZE, YTDLP_BIN } = require('./constants/download');
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
    YtDlp: YTDLP_BIN,
    MaxFilesizeMb: Math.round(MAX_FILESIZE / (1024 * 1024)),
    LimitRateMBps: Math.round(LIMIT_RATE_BYTES / (1024 * 1024)),
    DefaultHeight: DEFAULT_HEIGHT,
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

const fs = require('fs');
const os = require('os');
const path = require('path');

const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'),
);

function envNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

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
  download: {
    dir: process.env.MEDIA_TG_BOT_DOWNLOAD_DIR || path.join(os.tmpdir(), 'media-tg-bot'),
    cookiesFile: process.env.MEDIA_TG_BOT_COOKIES_FILE || '',
    ytdlpBin: process.env.MEDIA_TG_BOT_YTDLP_BIN || 'yt-dlp',
    maxFilesize: envNumber('MEDIA_TG_BOT_MAX_FILESIZE', 50 * 1024 * 1024),
    maxDurationSec: envNumber('MEDIA_TG_BOT_MAX_DURATION_SEC', 60 * 60),
    maxLinksPerMessage: envNumber('MEDIA_TG_BOT_MAX_LINKS', 1),
    probeTimeoutMs: envNumber('MEDIA_TG_BOT_PROBE_TIMEOUT_MS', 45 * 1000),
    downloadTimeoutMs: envNumber('MEDIA_TG_BOT_DOWNLOAD_TIMEOUT_MS', 8 * 60 * 1000),
    sessionTtlMs: envNumber('MEDIA_TG_BOT_SESSION_TTL_MS', 10 * 60 * 1000),
    defaultHeight: envNumber('MEDIA_TG_BOT_DEFAULT_HEIGHT', 720),
    autoDownloadMaxDurationSec: envNumber('MEDIA_TG_BOT_AUTO_DURATION_SEC', 90),
  },
};

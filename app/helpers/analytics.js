const { createTelegramTracker } = require('umami-server-tracker');
const config = require('../../config/default');

const { host, websiteId, hostname = 'brainrot-adapter' } = config.analytics?.umami || {};

const umami = createTelegramTracker({
  host,
  websiteId,
  hostname,
  onError: (error) => {
    console.error('[analytics]', error instanceof Error ? error.message : error);
  },
});

function track(ctxOrUserId, eventType, eventProperties) {
  return umami.track(ctxOrUserId, eventType, eventProperties);
}

const EVENTS = {
  START: 'START',
  HELP: 'HELP',
  DOWNLOAD_OK: 'DOWNLOAD_OK',
  DOWNLOAD_FAIL: 'DOWNLOAD_FAIL',
  CANCEL: 'CANCEL',
};

module.exports = {
  track,
  EVENTS,
};

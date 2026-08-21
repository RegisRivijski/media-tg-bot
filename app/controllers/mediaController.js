const { MAX_LINKS_PER_MESSAGE } = require('../constants/download');
const downloadJobHelper = require('../helpers/downloadJobHelper');
const { findMediaLinks, isCommandMessage } = require('../helpers/linkHelper');

async function onMessage(ctx, next) {
  if (!ctx.message || isCommandMessage(ctx.message)) {
    await next();
    return;
  }

  const links = findMediaLinks(ctx.message, MAX_LINKS_PER_MESSAGE);
  if (!links.length) {
    await next();
    return;
  }

  await downloadJobHelper.startFromMessage(ctx, links);
}

async function onCallback(ctx) {
  await downloadJobHelper.handleCallback(ctx);
}

module.exports = {
  onMessage,
  onCallback,
};

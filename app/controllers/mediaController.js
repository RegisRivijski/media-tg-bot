const config = require('../../config/default');
const downloadJobHelper = require('../helpers/downloadJobHelper');
const { findMediaLinks, isCommandMessage } = require('../helpers/linkHelper');

async function onMessage(ctx, next) {
  if (!ctx.message || isCommandMessage(ctx.message)) {
    await next();
    return;
  }

  const links = findMediaLinks(ctx.message, config.download.maxLinksPerMessage);
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

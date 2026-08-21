const { EVENTS, track } = require('../helpers/analytics');
const copy = require('../helpers/copyHelper');

async function start(ctx) {
  track(ctx, EVENTS.START);
  await ctx.reply(copy.startText(), copy.HTML);
}

async function help(ctx) {
  track(ctx, EVENTS.HELP);
  await ctx.reply(copy.helpText(), copy.HTML);
}

module.exports = {
  start,
  help,
};

const copy = require('../helpers/copyHelper');

async function start(ctx) {
  await ctx.reply(copy.startText(), copy.HTML);
}

async function help(ctx) {
  await ctx.reply(copy.helpText(), copy.HTML);
}

module.exports = {
  start,
  help,
};

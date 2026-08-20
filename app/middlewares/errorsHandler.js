const copy = require('../helpers/copyHelper');

module.exports = async function errorsHandler(ctx, next) {
  try {
    await next();
  } catch (err) {
    console.error('[bot]', err.message || err);

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(copy.unknownErrorText().slice(0, 200)).catch(() => {});
    }

    await ctx.reply(copy.unknownErrorText()).catch(() => {});
  }
};

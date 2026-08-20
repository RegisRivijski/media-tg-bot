const path = require('path');

const config = require('../../config/default');
const copy = require('./copyHelper');
const formatHelper = require('./formatHelper');
const keyboardHelper = require('./keyboardHelper');
const sendHelper = require('./sendHelper');
const sessionHelper = require('./sessionHelper');
const ytdlpHelper = require('./ytdlpHelper');

const EMPTY_KEYBOARD = { reply_markup: { inline_keyboard: [] } };

function startUploadAction(ctx) {
  const tick = () => {
    ctx.sendChatAction('upload_video').catch(() => {});
  };
  tick();
  const timer = setInterval(tick, 4000);
  return () => clearInterval(timer);
}

function languageName(session) {
  const match = (session.languages || []).find((item) => item.code === session.language);
  return match ? match.label : '';
}

function replyToOriginal(ctx, messageId) {
  return {
    ...copy.HTML,
    reply_to_message_id: messageId,
  };
}

async function handleDownloadError(ctx, status, error, replyToMessageId) {
  const code = ytdlpHelper.classifyYtDlpError(error);
  console.error('[media]', error.code || error.message);

  let text = copy.failedText();
  if (code === 'YTDLP_MISSING') {
    text = copy.missingBinaryText();
  } else if (code === 'TOO_LARGE') {
    text = copy.tooLargeText();
  } else if (code === 'PRIVATE') {
    text = copy.failedText();
  }

  if (status) {
    await sendHelper.editStatus(ctx, status, text, EMPTY_KEYBOARD);
    return;
  }
  await ctx.reply(text, replyToOriginal(ctx, replyToMessageId)).catch(() => {});
}

async function runDownload(ctx, status, session) {
  await sendHelper.editStatus(ctx, status, copy.downloadingText(session.title), EMPTY_KEYBOARD);
  const jobDir = path.join(
    config.download.dir,
    `${session.chatId}_${Date.now()}`,
  );
  const stopAction = startUploadAction(ctx);

  try {
    const files = await ytdlpHelper.downloadMedia({
      url: session.url,
      platform: session.platform,
      jobDir,
      height: session.resolution,
      language: session.language,
    });
    if (!files.length) {
      await sendHelper.editStatus(ctx, status, copy.nothingFoundText(), EMPTY_KEYBOARD);
      return;
    }

    await sendHelper.deleteStatus(ctx, status);
    await sendHelper.sendFiles(ctx, files, {
      caption: copy.captionText({
        title: session.title,
        platformLabel: session.platformLabel,
        height: session.resolution,
        languageLabelValue: languageName(session),
      }),
      replyToMessageId: session.replyToMessageId,
      duration: session.duration || undefined,
    });
  } catch (error) {
    await handleDownloadError(ctx, status, error, session.replyToMessageId);
  } finally {
    stopAction();
    ytdlpHelper.removeDir(jobDir);
  }
}

function statusFromSession(session) {
  return {
    chat: { id: session.chatId },
    message_id: session.statusMessageId,
  };
}

async function finishDownloadFromCallback(ctx, jobId) {
  const session = sessionHelper.getSession(jobId);
  sessionHelper.removeSession(jobId);
  if (!session) {
    await ctx.editMessageText(copy.expiredText(), copy.HTML).catch(() => {});
    return;
  }
  if (sessionHelper.isChatBusy(session.chatId)) {
    await ctx.editMessageText(copy.busyText(), copy.HTML).catch(() => {});
    return;
  }

  sessionHelper.markChatBusy(session.chatId);
  try {
    await runDownload(ctx, statusFromSession(session), session);
  } finally {
    sessionHelper.markChatFree(session.chatId);
  }
}

async function processLink(ctx, link) {
  const status = await ctx.reply(copy.lookingText(), replyToOriginal(ctx, ctx.message.message_id));

  let info;
  try {
    info = await ytdlpHelper.probeMedia(link.url, link.platform);
  } catch (error) {
    await handleDownloadError(ctx, status, error, ctx.message.message_id);
    return;
  }

  if (formatHelper.isLiveInfo(info)) {
    await sendHelper.editStatus(ctx, status, copy.liveStreamText());
    return;
  }

  const duration = Number(info.duration) || 0;
  if (duration > config.download.maxDurationSec) {
    await sendHelper.editStatus(ctx, status, copy.tooLongText());
    return;
  }

  const entries = formatHelper.flattenEntries(info);
  const onlyImages = entries.length && entries.every((entry) => formatHelper.isImageInfo(entry));
  const languages = onlyImages ? [] : formatHelper.collectLanguages(info);
  const resolutions = onlyImages ? [] : formatHelper.collectResolutions(info);
  const language = formatHelper.defaultLanguage(languages, ctx.from?.language_code);
  const resolution = formatHelper.defaultResolution(resolutions, config.download.defaultHeight);
  const title = info.title || '';
  const askLanguage = languages.length > 1;
  const askResolution = resolutions.length > 1
    && duration > config.download.autoDownloadMaxDurationSec;

  const session = {
    url: link.url,
    platform: link.platform,
    platformLabel: link.platformLabel,
    title,
    duration,
    languages,
    resolutions,
    language,
    resolution,
    chatId: ctx.chat.id,
    userId: ctx.from.id,
    replyToMessageId: ctx.message.message_id,
    statusMessageId: status.message_id,
  };

  if (askLanguage) {
    const jobId = sessionHelper.createSession(session);
    await sendHelper.editStatus(
      ctx,
      status,
      copy.chooseLanguageText(title),
      keyboardHelper.languageKeyboard(jobId, languages),
    );
    return;
  }

  if (askResolution) {
    const jobId = sessionHelper.createSession(session);
    await sendHelper.editStatus(
      ctx,
      status,
      copy.chooseResolutionText(title),
      keyboardHelper.resolutionKeyboard(jobId, resolutions),
    );
    return;
  }

  await runDownload(ctx, status, session);
}

async function startFromMessage(ctx, links) {
  const chatId = ctx.chat.id;
  if (sessionHelper.isChatBusy(chatId)) {
    await ctx.reply(copy.busyText(), replyToOriginal(ctx, ctx.message.message_id));
    return;
  }

  sessionHelper.markChatBusy(chatId);
  try {
    await processLink(ctx, links[0]);
  } finally {
    sessionHelper.markChatFree(chatId);
  }
}

async function handleCallback(ctx) {
  const parsed = keyboardHelper.parseCallbackData(ctx.callbackQuery.data);
  if (!parsed) {
    return;
  }

  const session = sessionHelper.getSession(parsed.jobId);
  if (!session) {
    await ctx.answerCbQuery(copy.expiredText());
    return;
  }
  if (session.userId !== ctx.from.id) {
    await ctx.answerCbQuery(copy.notYourChoiceText(), { show_alert: true });
    return;
  }

  if (parsed.action === 'x') {
    sessionHelper.removeSession(parsed.jobId);
    await ctx.answerCbQuery();
    await ctx.editMessageText(copy.cancelledText(), copy.HTML).catch(() => {});
    return;
  }

  if (sessionHelper.isChatBusy(session.chatId)) {
    await ctx.answerCbQuery(copy.busyText(), { show_alert: true });
    return;
  }

  if (parsed.action === 'l') {
    const next = sessionHelper.updateSession(parsed.jobId, { language: parsed.value });
    if (!next) {
      await ctx.answerCbQuery(copy.expiredText());
      return;
    }
    await ctx.answerCbQuery();
    const shouldAskResolution = next.resolutions.length > 1
      && next.duration > config.download.autoDownloadMaxDurationSec;
    if (shouldAskResolution) {
      await ctx.editMessageText(
        copy.chooseResolutionText(next.title, languageName(next)),
        { ...copy.HTML, ...keyboardHelper.resolutionKeyboard(parsed.jobId, next.resolutions) },
      ).catch(() => {});
      return;
    }
    await finishDownloadFromCallback(ctx, parsed.jobId);
    return;
  }

  if (parsed.action === 'r') {
    const next = sessionHelper.updateSession(parsed.jobId, { resolution: Number(parsed.value) });
    if (!next) {
      await ctx.answerCbQuery(copy.expiredText());
      return;
    }
    await ctx.answerCbQuery();
    await finishDownloadFromCallback(ctx, parsed.jobId);
  }
}

module.exports = {
  startFromMessage,
  handleCallback,
};

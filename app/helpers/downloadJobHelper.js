const path = require('path');

const {
  AUTO_DOWNLOAD_MAX_DURATION_SEC,
  DEFAULT_HEIGHT,
  DOWNLOAD_DIR,
  MAX_DURATION_SEC,
} = require('../constants/download');
const copy = require('./copyHelper');
const formatHelper = require('./formatHelper');
const ffmpegHelper = require('./ffmpegHelper');
const keyboardHelper = require('./keyboardHelper');
const sendHelper = require('./sendHelper');
const sessionHelper = require('./sessionHelper');
const ytdlpHelper = require('./ytdlpHelper');
const { EVENTS, track } = require('./analytics');

const EMPTY_KEYBOARD = { reply_markup: { inline_keyboard: [] } };

function startUploadAction(ctx, kind = 'video') {
  const action = kind === 'audio'
    ? 'upload_audio'
    : (kind === 'photo' ? 'upload_photo' : 'upload_video');
  const tick = () => {
    ctx.sendChatAction(action).catch(() => {});
  };
  tick();
  const timer = setInterval(tick, 4000);
  return () => clearInterval(timer);
}

function shouldAskQuality(session) {
  if (session.onlyImages || session.isAlbum) {
    return false;
  }
  return session.duration > AUTO_DOWNLOAD_MAX_DURATION_SEC
    && (session.resolutions || []).length > 0;
}

function languageName(session) {
  const match = (session.languages || []).find((item) => item.code === session.language);
  return match ? match.label : '';
}

function downloadProps(session = {}, extra = {}) {
  const props = {
    platform: session.platform,
    kind: session.mediaKind || 'video',
    duration: session.duration || 0,
    ...extra,
  };
  if (session.items) {
    props.items = session.items;
  }
  if (props.kind !== 'audio' && session.resolution) {
    props.height = session.resolution;
  }
  if (session.language) {
    props.language = session.language;
  }
  return props;
}

function replyToOriginal(ctx, messageId) {
  return {
    ...copy.HTML,
    reply_to_message_id: messageId,
  };
}

async function handleDownloadError(ctx, status, error, replyToMessageId, extra = {}) {
  const code = ytdlpHelper.classifyYtDlpError(error);
  console.error('[media]', error.code || error.message);
  track(ctx, EVENTS.DOWNLOAD_FAIL, { ...extra, reason: extra.reason || code });

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
  const isAudio = session.mediaKind === 'audio';
  await sendHelper.editStatus(ctx, status, copy.downloadingText(session.title), EMPTY_KEYBOARD);
  const jobDir = path.join(
    DOWNLOAD_DIR,
    `${session.chatId}_${Date.now()}`,
  );
  const stopAction = startUploadAction(
    ctx,
    isAudio ? 'audio' : (session.onlyImages ? 'photo' : 'video'),
  );

  try {
    const files = await ytdlpHelper.downloadMedia({
      url: session.url,
      platform: session.platform,
      jobDir,
      height: session.resolution,
      language: session.language,
      audio: isAudio,
      imagesOnly: session.onlyImages,
    });
    if (!files.length) {
      track(ctx, EVENTS.DOWNLOAD_FAIL, downloadProps(session, { reason: 'empty' }));
      await sendHelper.editStatus(ctx, status, copy.nothingFoundText(), EMPTY_KEYBOARD);
      return;
    }

    const ready = isAudio ? files : await ffmpegHelper.prepareVideos(files);

    await sendHelper.deleteStatus(ctx, status);
    await sendHelper.sendFiles(ctx, ready, {
      caption: isAudio
        ? undefined
        : copy.captionText({
          title: session.title,
          platformLabel: session.platformLabel,
          height: (session.onlyImages || session.isAlbum) ? undefined : session.resolution,
          languageLabelValue: languageName(session),
        }),
      audioTitle: isAudio ? (session.title || session.platformLabel) : undefined,
      audioPerformer: isAudio ? session.platformLabel : undefined,
      replyToMessageId: session.replyToMessageId,
      duration: session.duration || undefined,
    });
    track(ctx, EVENTS.DOWNLOAD_OK, downloadProps(session));
  } catch (error) {
    await handleDownloadError(ctx, status, error, session.replyToMessageId, downloadProps(session));
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
    track(ctx, EVENTS.DOWNLOAD_FAIL, { reason: 'expired' });
    await ctx.editMessageText(copy.expiredText(), copy.HTML).catch(() => {});
    return;
  }
  if (sessionHelper.isChatBusy(session.chatId)) {
    track(ctx, EVENTS.DOWNLOAD_FAIL, downloadProps(session, { reason: 'busy' }));
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
    await handleDownloadError(ctx, status, error, ctx.message.message_id, {
      platform: link.platform,
    });
    return;
  }

  const entries = formatHelper.flattenEntries(info);
  if (formatHelper.isLiveInfo(info) || entries.some((entry) => formatHelper.isLiveInfo(entry))) {
    track(ctx, EVENTS.DOWNLOAD_FAIL, { platform: link.platform, reason: 'live' });
    await sendHelper.editStatus(ctx, status, copy.liveStreamText());
    return;
  }

  const duration = formatHelper.maxDuration(info);
  if (duration > MAX_DURATION_SEC) {
    track(ctx, EVENTS.DOWNLOAD_FAIL, { platform: link.platform, reason: 'too_long', duration });
    await sendHelper.editStatus(ctx, status, copy.tooLongText());
    return;
  }

  const isAlbum = formatHelper.isAlbumInfo(info);
  const onlyImages = formatHelper.isImagesOnly(info);
  const probeTarget = entries.length === 1 ? entries[0] : info;
  const languages = (onlyImages || isAlbum) ? [] : formatHelper.collectLanguages(probeTarget);
  const resolutions = (onlyImages || isAlbum) ? [] : formatHelper.collectResolutions(probeTarget);
  const language = formatHelper.defaultLanguage(languages, ctx.from?.language_code);
  const resolution = onlyImages
    ? undefined
    : formatHelper.defaultResolution(resolutions, DEFAULT_HEIGHT);
  const title = info.title || '';
  const askLanguage = !onlyImages && !isAlbum && languages.length > 1;
  let mediaKind = 'video';
  if (onlyImages) {
    mediaKind = isAlbum ? 'album' : 'photo';
  } else if (isAlbum) {
    mediaKind = 'album';
  }

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
    mediaKind,
    onlyImages,
    isAlbum,
    items: entries.length,
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

  if (shouldAskQuality(session)) {
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
    track(ctx, EVENTS.DOWNLOAD_FAIL, { reason: 'busy' });
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
    track(ctx, EVENTS.DOWNLOAD_FAIL, { reason: 'expired' });
    await ctx.answerCbQuery(copy.expiredText());
    return;
  }
  if (session.userId !== ctx.from.id) {
    await ctx.answerCbQuery(copy.notYourChoiceText(), { show_alert: true });
    return;
  }

  if (parsed.action === 'x') {
    sessionHelper.removeSession(parsed.jobId);
    track(ctx, EVENTS.CANCEL, downloadProps(session));
    await ctx.answerCbQuery();
    await ctx.editMessageText(copy.cancelledText(), copy.HTML).catch(() => {});
    return;
  }

  if (sessionHelper.isChatBusy(session.chatId)) {
    track(ctx, EVENTS.DOWNLOAD_FAIL, downloadProps(session, { reason: 'busy' }));
    await ctx.answerCbQuery(copy.busyText(), { show_alert: true });
    return;
  }

  if (parsed.action === 'l') {
    const next = sessionHelper.updateSession(parsed.jobId, { language: parsed.value });
    if (!next) {
      track(ctx, EVENTS.DOWNLOAD_FAIL, { reason: 'expired' });
      await ctx.answerCbQuery(copy.expiredText());
      return;
    }
    await ctx.answerCbQuery();
    if (shouldAskQuality(next)) {
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
    const next = sessionHelper.updateSession(parsed.jobId, {
      resolution: Number(parsed.value),
      mediaKind: 'video',
    });
    if (!next) {
      track(ctx, EVENTS.DOWNLOAD_FAIL, { reason: 'expired' });
      await ctx.answerCbQuery(copy.expiredText());
      return;
    }
    await ctx.answerCbQuery();
    await finishDownloadFromCallback(ctx, parsed.jobId);
    return;
  }

  if (parsed.action === 'a') {
    const next = sessionHelper.updateSession(parsed.jobId, { mediaKind: 'audio' });
    if (!next) {
      track(ctx, EVENTS.DOWNLOAD_FAIL, { reason: 'expired' });
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

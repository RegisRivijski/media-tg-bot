const fs = require('fs');
const path = require('path');

const { HTML } = require('./copyHelper');
const ffmpegHelper = require('./ffmpegHelper');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.m4v']);
const AUDIO_EXTS = new Set(['.m4a', '.mp3', '.ogg', '.opus', '.wav', '.aac']);

function fileKind(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (IMAGE_EXTS.has(ext)) {
    return 'photo';
  }
  if (VIDEO_EXTS.has(ext)) {
    return 'video';
  }
  if (AUDIO_EXTS.has(ext)) {
    return 'audio';
  }
  return 'document';
}

function asInput(filePath) {
  return { source: fs.createReadStream(filePath) };
}

function chunk(items, size) {
  const groups = [];
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
}

async function videoSendMeta(filePath, { duration, width, height } = {}) {
  const meta = await ffmpegHelper.probeVideo(filePath).catch(() => ({}));
  const thumbPath = await ffmpegHelper.makeThumb(filePath).catch(() => null);
  return {
    supports_streaming: true,
    duration: meta.duration || duration,
    width: meta.width || width,
    height: meta.height || height,
    thumb: thumbPath ? asInput(thumbPath) : undefined,
  };
}

async function sendFiles(ctx, files, {
  caption,
  replyToMessageId,
  duration,
  width,
  height,
  audioTitle,
  audioPerformer,
} = {}) {
  if (!files.length) {
    return;
  }

  const extra = {
    ...HTML,
    reply_to_message_id: replyToMessageId,
  };
  if (caption) {
    extra.caption = caption;
  }

  const visual = files.filter((filePath) => {
    const kind = fileKind(filePath);
    return kind === 'photo' || kind === 'video';
  });
  const toSend = visual.length ? visual : files;

  if (toSend.length === 1) {
    const kind = fileKind(toSend[0]);
    if (kind === 'video') {
      const videoExtra = await videoSendMeta(toSend[0], { duration, width, height });
      try {
        await ctx.replyWithVideo(asInput(toSend[0]), {
          ...extra,
          ...videoExtra,
        });
      } catch (error) {
        console.warn('[send] video failed, sending as document', error.message);
        await ctx.replyWithDocument(asInput(toSend[0]), extra);
      }
      return;
    }
    if (kind === 'photo') {
      await ctx.replyWithPhoto(asInput(toSend[0]), extra);
      return;
    }
    if (kind === 'audio') {
      try {
        await ctx.replyWithAudio(asInput(toSend[0]), {
          ...extra,
          duration,
          title: audioTitle,
          performer: audioPerformer,
        });
      } catch (error) {
        console.warn('[send] audio failed, sending as document', error.message);
        await ctx.replyWithDocument(asInput(toSend[0]), extra);
      }
      return;
    }
    await ctx.replyWithDocument(asInput(toSend[0]), extra);
    return;
  }

  const groups = chunk(toSend, 10);
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const media = [];
    for (const [index, filePath] of groups[groupIndex].entries()) {
      const kind = fileKind(filePath);
      const item = {
        type: kind === 'video' ? 'video' : 'photo',
        media: asInput(filePath),
      };
      if (groupIndex === 0 && index === 0 && caption) {
        item.caption = caption;
        item.parse_mode = 'HTML';
      }
      if (item.type === 'video') {
        const videoExtra = await videoSendMeta(filePath);
        Object.assign(item, videoExtra);
      }
      media.push(item);
    }

    await ctx.replyWithMediaGroup(media, {
      reply_to_message_id: replyToMessageId,
    });
  }
}

async function editStatus(ctx, status, text, extra = {}) {
  if (!status) {
    return;
  }
  await ctx.telegram.editMessageText(
    status.chat.id,
    status.message_id,
    undefined,
    text,
    { ...HTML, ...extra },
  ).catch(() => {});
}

async function deleteStatus(ctx, status) {
  if (!status) {
    return;
  }
  await ctx.telegram.deleteMessage(status.chat.id, status.message_id).catch(() => {});
}

module.exports = {
  fileKind,
  sendFiles,
  editStatus,
  deleteStatus,
};

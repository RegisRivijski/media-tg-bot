const fs = require('fs');
const path = require('path');

const { HTML } = require('./copyHelper');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.mkv', '.webm']);
const AUDIO_EXTS = new Set(['.m4a', '.mp3', '.ogg', '.opus', '.wav']);

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

async function sendFiles(ctx, files, { caption, replyToMessageId, duration, width, height } = {}) {
  if (!files.length) {
    return;
  }

  const extra = {
    ...HTML,
    caption,
    reply_to_message_id: replyToMessageId,
  };

  const visual = files.filter((filePath) => {
    const kind = fileKind(filePath);
    return kind === 'photo' || kind === 'video';
  });
  const toSend = visual.length ? visual : files;

  if (toSend.length === 1) {
    const kind = fileKind(toSend[0]);
    if (kind === 'video') {
      try {
        await ctx.replyWithVideo(asInput(toSend[0]), {
          ...extra,
          supports_streaming: true,
          duration,
          width,
          height,
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
      await ctx.replyWithAudio(asInput(toSend[0]), extra);
      return;
    }
    await ctx.replyWithDocument(asInput(toSend[0]), extra);
    return;
  }

  const media = toSend.slice(0, 10).map((filePath, index) => {
    const kind = fileKind(filePath);
    const item = {
      type: kind === 'video' ? 'video' : 'photo',
      media: asInput(filePath),
    };
    if (index === 0 && caption) {
      item.caption = caption;
      item.parse_mode = 'HTML';
    }
    if (item.type === 'video') {
      item.supports_streaming = true;
    }
    return item;
  });

  await ctx.replyWithMediaGroup(media, {
    reply_to_message_id: replyToMessageId,
  });
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

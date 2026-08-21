const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const {
  FFMPEG_BIN,
  FFPROBE_BIN,
  FFMPEG_TIMEOUT_MS,
} = require('../constants/download');

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.m4v']);
const PHOTO_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.avif', '.bmp']);
const PHOTO_CONVERT_EXTS = new Set(['.webp', '.heic', '.heif', '.avif', '.bmp']);
const SAFE_PIX = new Set(['yuv420p', 'yuvj420p']);

function run(bin, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      const error = new Error(`${bin} timed out`);
      error.code = 'FFMPEG_TIMEOUT';
      reject(error);
    }, timeoutMs || FFMPEG_TIMEOUT_MS);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      if (err.code === 'ENOENT') {
        const error = new Error(`${bin} is not installed`);
        error.code = 'FFMPEG_MISSING';
        reject(error);
        return;
      }
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const error = new Error((stderr || stdout).slice(-800) || `${bin} exited ${code}`);
        error.code = 'FFMPEG_FAIL';
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function ffprobe(filePath) {
  const { stdout } = await run(FFPROBE_BIN, [
    '-v', 'error',
    '-show_format',
    '-show_streams',
    '-of', 'json',
    filePath,
  ], 20 * 1000);
  return JSON.parse(stdout);
}

function primaryVideo(probe) {
  return (probe.streams || []).find((stream) => (
    stream.codec_type === 'video'
    && stream.codec_name !== 'mjpeg'
    && stream.codec_name !== 'png'
    && stream.codec_name !== 'webp'
  ));
}

function primaryAudio(probe) {
  return (probe.streams || []).find((stream) => stream.codec_type === 'audio');
}

function hasRotation(stream) {
  const rotate = Number(stream.tags?.rotate || 0);
  if (rotate && rotate % 360 !== 0) {
    return true;
  }
  const matrix = (stream.side_data_list || []).find((item) => (
    /display matrix/i.test(item.side_data_type || '')
  ));
  return Boolean(matrix && Number(matrix.rotation));
}

function isMp4(probe) {
  return /(^|,)(mp4|isom|iso2|mp41|mp42)(,|$)/i.test(probe.format?.format_name || '');
}

function hasFaststart(filePath) {
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(256 * 1024);
  const bytes = fs.readSync(fd, buf, 0, buf.length, 0);
  fs.closeSync(fd);
  const head = buf.slice(0, bytes).toString('latin1');
  const moov = head.indexOf('moov');
  const mdat = head.indexOf('mdat');
  if (moov === -1) {
    return false;
  }
  if (mdat === -1) {
    return true;
  }
  return moov < mdat;
}

function isTelegramSafe(probe, filePath) {
  const video = primaryVideo(probe);
  const audio = primaryAudio(probe);
  if (!video) {
    return true;
  }
  const even = video.width % 2 === 0 && video.height % 2 === 0;
  const h264 = video.codec_name === 'h264';
  const pix = SAFE_PIX.has(streamPix(video));
  const aac = !audio || audio.codec_name === 'aac';
  return h264 && pix && even && aac && !hasRotation(video) && isMp4(probe) && hasFaststart(filePath);
}

function streamPix(video) {
  return String(video.pix_fmt || '');
}

function videoMeta(probe) {
  const video = primaryVideo(probe);
  if (!video) {
    return {};
  }
  const duration = Math.round(Number(probe.format?.duration || video.duration) || 0);
  return {
    width: Number(video.width) || undefined,
    height: Number(video.height) || undefined,
    duration: duration || undefined,
  };
}

async function probeVideo(filePath) {
  const probe = await ffprobe(filePath);
  return { probe, ...videoMeta(probe) };
}

async function ffmpegCopyFaststart(input, output) {
  await run(FFMPEG_BIN, [
    '-y',
    '-i', input,
    '-map', '0',
    '-c', 'copy',
    '-movflags', '+faststart',
    output,
  ]);
}

async function ffmpegTranscode(input, output) {
  await run(FFMPEG_BIN, [
    '-y',
    '-i', input,
    '-map', '0:v:0',
    '-map', '0:a:0?',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'high',
    '-level', '4.2',
    '-tag:v', 'avc1',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ac', '2',
    '-ar', '48000',
    '-movflags', '+faststart',
    output,
  ]);
}

function replaceOriginal(original, next) {
  if (!fs.existsSync(next) || !fs.statSync(next).size) {
    return original;
  }
  if (next !== original) {
    fs.unlinkSync(original);
  }
  return next;
}

async function ensureTelegramVideo(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!VIDEO_EXTS.has(ext)) {
    return filePath;
  }

  let probe;
  try {
    probe = await ffprobe(filePath);
  } catch (error) {
    console.warn('[ffmpeg] probe failed', error.message);
    return filePath;
  }
  if (!primaryVideo(probe)) {
    return filePath;
  }
  if (isTelegramSafe(probe, filePath)) {
    return filePath;
  }

  const output = `${filePath.replace(/\.[^.]+$/, '')}.tg.mp4`;
  try {
    const audio = primaryAudio(probe);
    const video = primaryVideo(probe);
    const canCopy = video.codec_name === 'h264'
      && SAFE_PIX.has(streamPix(video))
      && video.width % 2 === 0
      && video.height % 2 === 0
      && !hasRotation(video)
      && (!audio || audio.codec_name === 'aac');
    if (canCopy) {
      await ffmpegCopyFaststart(filePath, output);
    } else {
      await ffmpegTranscode(filePath, output);
    }
    return replaceOriginal(filePath, output);
  } catch (error) {
    console.warn('[ffmpeg] convert failed, sending original', error.message);
    fs.rmSync(output, { force: true });
    return filePath;
  }
}

async function ensureTelegramPhoto(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!PHOTO_EXTS.has(ext) || !PHOTO_CONVERT_EXTS.has(ext)) {
    return filePath;
  }

  const output = `${filePath.replace(/\.[^.]+$/, '')}.tg.jpg`;
  try {
    await run(FFMPEG_BIN, [
      '-y',
      '-i', filePath,
      '-frames:v', '1',
      '-q:v', '2',
      output,
    ], 20 * 1000);
    return replaceOriginal(filePath, output);
  } catch (error) {
    console.warn('[ffmpeg] photo convert failed, sending original', error.message);
    fs.rmSync(output, { force: true });
    return filePath;
  }
}

async function prepareVideos(files) {
  const next = [];
  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    if (VIDEO_EXTS.has(ext)) {
      next.push(await ensureTelegramVideo(filePath));
    } else if (PHOTO_EXTS.has(ext)) {
      next.push(await ensureTelegramPhoto(filePath));
    } else {
      next.push(filePath);
    }
  }
  return next;
}

async function makeThumb(filePath) {
  const thumbPath = `${filePath.replace(/\.[^.]+$/, '')}.thumb.jpg`;
  const scale = 'scale=320:320:force_original_aspect_ratio=decrease';
  try {
    await run(FFMPEG_BIN, [
      '-y',
      '-ss', '0.3',
      '-i', filePath,
      '-frames:v', '1',
      '-an',
      '-q:v', '4',
      '-vf', scale,
      thumbPath,
    ], 20 * 1000);
  } catch {
    await run(FFMPEG_BIN, [
      '-y',
      '-i', filePath,
      '-frames:v', '1',
      '-an',
      '-q:v', '4',
      '-vf', scale,
      thumbPath,
    ], 20 * 1000);
  }
  if (!fs.existsSync(thumbPath) || !fs.statSync(thumbPath).size) {
    throw new Error('thumb empty');
  }
  return thumbPath;
}

module.exports = {
  probeVideo,
  makeThumb,
  ensureTelegramVideo,
  prepareVideos,
};

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const {
  COOKIES_FILE,
  DOWNLOAD_DIR,
  DOWNLOAD_TIMEOUT_MS,
  LIMIT_RATE_BYTES,
  MAX_FILESIZE,
  MAX_PLAYLIST_ITEMS,
  PROBE_TIMEOUT_MS,
  YTDLP_BIN,
} = require('../constants/download');
const { buildAudioFormatSelector, buildFormatSelector } = require('./formatHelper');

function extraCookieArgs() {
  if (COOKIES_FILE && fs.existsSync(COOKIES_FILE)) {
    return ['--cookies', COOKIES_FILE];
  }
  return [];
}

function extraRateArgs() {
  if (!LIMIT_RATE_BYTES) {
    return [];
  }
  return ['--limit-rate', String(LIMIT_RATE_BYTES)];
}

function extraExtractArgs() {
  return ['--ignore-errors', '--ignore-no-formats-error'];
}

function extraInstagramArgs(platform) {
  if (platform !== 'instagram') {
    return [];
  }
  return [
    '--write-thumbnail',
    '--convert-thumbnails', 'jpg',
  ];
}

function runYtDlp(args, { timeoutMs } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      const error = new Error('yt-dlp timed out');
      error.code = 'YTDLP_TIMEOUT';
      reject(error);
    }, timeoutMs || PROBE_TIMEOUT_MS);

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
        const error = new Error('yt-dlp is not installed');
        error.code = 'YTDLP_MISSING';
        reject(error);
        return;
      }
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      // 101 = --max-downloads reached; files are still usable.
      if (code !== 0 && code !== 101) {
        const error = new Error((stderr || stdout).slice(-800) || `yt-dlp exited ${code}`);
        error.code = 'YTDLP_FAIL';
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function parseDumpJson(stdout) {
  const trimmed = String(stdout || '').trim();
  if (!trimmed) {
    const error = new Error('empty yt-dlp json');
    error.code = 'YTDLP_FAIL';
    throw error;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // JSONL or JSON mixed with log lines
  }

  const objects = [];
  trimmed.split('\n').forEach((line) => {
    const candidate = line.trim();
    if (!candidate.startsWith('{')) {
      return;
    }
    try {
      objects.push(JSON.parse(candidate));
    } catch {
      // skip
    }
  });

  if (objects.length === 1) {
    return objects[0];
  }
  if (objects.length > 1) {
    return {
      _type: 'playlist',
      title: objects[0].playlist_title || objects[0].title || '',
      entries: objects,
    };
  }

  const error = new Error('empty yt-dlp json');
  error.code = 'YTDLP_FAIL';
  throw error;
}

function playlistArg(platform) {
  return platform === 'youtube' ? '--no-playlist' : '--yes-playlist';
}

async function probeMedia(url, platform) {
  let stdout = '';
  try {
    ({ stdout } = await runYtDlp([
      '-J',
      '--quiet',
      '--no-warnings',
      '--skip-download',
      ...extraExtractArgs(),
      playlistArg(platform),
      ...extraCookieArgs(),
      url,
    ], { timeoutMs: PROBE_TIMEOUT_MS }));
  } catch (error) {
    stdout = error.stdout || '';
    if (!String(stdout).trim()) {
      throw error;
    }
  }

  return parseDumpJson(stdout);
}

const AUDIO_EXTS = new Set(['.m4a', '.mp3', '.ogg', '.opus', '.wav', '.aac']);
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.m4v']);

function fileStem(filePath) {
  return filePath.slice(0, filePath.length - path.extname(filePath).length);
}

function dropVideoThumbs(files) {
  const videoStems = new Set(
    files
      .filter((filePath) => VIDEO_EXTS.has(path.extname(filePath).toLowerCase()))
      .map(fileStem),
  );
  return files.filter((filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (!IMAGE_EXTS.has(ext)) {
      return true;
    }
    return !videoStems.has(fileStem(filePath));
  });
}

function listDownloadedFiles(jobDir, { audioOnly } = {}) {
  if (!fs.existsSync(jobDir)) {
    return [];
  }
  const skipExt = new Set(['.part', '.ytdl', '.json', '.tmp']);
  const files = fs.readdirSync(jobDir)
    .map((name) => path.join(jobDir, name))
    .filter((filePath) => {
      const stat = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const name = path.basename(filePath).toLowerCase();
      if (name.endsWith('.thumb.jpg')) {
        return false;
      }
      return stat.isFile() && stat.size > 0 && !skipExt.has(ext);
    })
    .sort();
  if (audioOnly) {
    const audio = files.filter((filePath) => AUDIO_EXTS.has(path.extname(filePath).toLowerCase()));
    return audio.length ? audio : files;
  }
  return dropVideoThumbs(files);
}

async function downloadMedia({ url, platform, jobDir, height, language, audio, imagesOnly }) {
  fs.mkdirSync(jobDir, { recursive: true });
  const output = path.join(jobDir, '%(autonumber)03d_%(id)s.%(ext)s');
  const skipVideoFormat = !audio && (imagesOnly || platform === 'instagram');
  const format = audio
    ? buildAudioFormatSelector(language)
    : buildFormatSelector({ height, language });
  const formatArgs = skipVideoFormat ? [] : ['-f', format];
  const mediaArgs = audio
    ? ['-x', '--audio-format', 'm4a', '--audio-quality', '0']
    : (imagesOnly
      ? []
      : ['--merge-output-format', 'mp4', '--remux-video', 'mp4',
        '--postprocessor-args', 'ffmpeg:-movflags +faststart']);

  try {
    await runYtDlp([
      '--quiet',
      '--no-warnings',
      '--no-mtime',
      ...extraExtractArgs(),
      ...extraInstagramArgs(platform),
      playlistArg(platform),
      '--max-downloads', String(MAX_PLAYLIST_ITEMS),
      '--playlist-end', String(MAX_PLAYLIST_ITEMS),
      '--max-filesize', String(MAX_FILESIZE),
      ...extraRateArgs(),
      ...mediaArgs,
      ...formatArgs,
      '-o', output,
      '-o', `thumbnail:${output}`,
      ...extraCookieArgs(),
      url,
    ], { timeoutMs: DOWNLOAD_TIMEOUT_MS });
  } catch (error) {
    const files = listDownloadedFiles(jobDir, { audioOnly: Boolean(audio) });
    if (files.length) {
      console.warn('[ytdlp] partial download', error.message);
      return files;
    }
    throw error;
  }

  return listDownloadedFiles(jobDir, { audioOnly: Boolean(audio) });
}

function removeDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

function cleanupDownloadRoot() {
  fs.rmSync(DOWNLOAD_DIR, { recursive: true, force: true });
}

function classifyYtDlpError(error) {
  const text = `${error.message || ''} ${error.stderr || ''}`.toLowerCase();
  if (error.code === 'YTDLP_MISSING') {
    return error.code;
  }
  if (error.code === 'YTDLP_TIMEOUT') {
    return error.code;
  }
  if (/file is larger than max-filesize|too large/.test(text)) {
    return 'TOO_LARGE';
  }
  if (/private|login required|join this channel|members-only/.test(text)) {
    return 'PRIVATE';
  }
  return 'YTDLP_FAIL';
}

module.exports = {
  probeMedia,
  downloadMedia,
  listDownloadedFiles,
  removeDir,
  cleanupDownloadRoot,
  classifyYtDlpError,
};

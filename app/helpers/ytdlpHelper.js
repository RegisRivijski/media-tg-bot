const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const config = require('../../config/default');
const { buildFormatSelector } = require('./formatHelper');

function extraCookieArgs() {
  if (config.download.cookiesFile && fs.existsSync(config.download.cookiesFile)) {
    return ['--cookies', config.download.cookiesFile];
  }
  return [];
}

function runYtDlp(args, { timeoutMs } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(config.download.ytdlpBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      const error = new Error('yt-dlp timed out');
      error.code = 'YTDLP_TIMEOUT';
      reject(error);
    }, timeoutMs || config.download.probeTimeoutMs);

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
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function playlistArg(platform) {
  return platform === 'youtube' ? '--no-playlist' : '--yes-playlist';
}

async function probeMedia(url, platform) {
  const { stdout } = await runYtDlp([
    '-J',
    '--quiet',
    '--no-warnings',
    '--skip-download',
    playlistArg(platform),
    ...extraCookieArgs(),
    url,
  ], { timeoutMs: config.download.probeTimeoutMs });

  const trimmed = stdout.trim();
  if (!trimmed) {
    const error = new Error('empty yt-dlp json');
    error.code = 'YTDLP_FAIL';
    throw error;
  }
  return JSON.parse(trimmed);
}

function listDownloadedFiles(jobDir) {
  if (!fs.existsSync(jobDir)) {
    return [];
  }
  const skipExt = new Set(['.part', '.ytdl', '.json', '.tmp']);
  return fs.readdirSync(jobDir)
    .map((name) => path.join(jobDir, name))
    .filter((filePath) => {
      const stat = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      return stat.isFile() && stat.size > 0 && !skipExt.has(ext);
    })
    .sort();
}

async function downloadMedia({ url, platform, jobDir, height, language }) {
  fs.mkdirSync(jobDir, { recursive: true });
  const output = path.join(jobDir, '%(id)s_%(autonumber)s.%(ext)s');
  const format = buildFormatSelector({ height, language });

  await runYtDlp([
    '--quiet',
    '--no-warnings',
    '--no-mtime',
    playlistArg(platform),
    '--max-downloads', '10',
    '--max-filesize', String(config.download.maxFilesize),
    '--merge-output-format', 'mp4',
    '--remux-video', 'mp4',
    '-f', format,
    '-o', output,
    ...extraCookieArgs(),
    url,
  ], { timeoutMs: config.download.downloadTimeoutMs });

  return listDownloadedFiles(jobDir);
}

function removeDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
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
  classifyYtDlpError,
};

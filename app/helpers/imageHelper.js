const fs = require('fs');
const path = require('path');

const { COOKIES_FILE } = require('../constants/download');

function instagramCookieHeader() {
  if (!COOKIES_FILE || !fs.existsSync(COOKIES_FILE)) {
    return '';
  }
  const parts = [];
  fs.readFileSync(COOKIES_FILE, 'utf8').split('\n').forEach((line) => {
    if (!line || line.startsWith('#')) {
      return;
    }
    const cols = line.split('\t');
    if (cols.length < 7) {
      return;
    }
    const domain = String(cols[0] || '').replace(/^\./, '');
    if (!/instagram\.com$/i.test(domain)) {
      return;
    }
    parts.push(`${cols[5]}=${cols[6]}`);
  });
  return parts.join('; ');
}

function extFromUrl(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith('.png')) {
      return '.png';
    }
    if (pathname.endsWith('.webp')) {
      return '.webp';
    }
    if (pathname.endsWith('.jpeg')) {
      return '.jpeg';
    }
  } catch {
    // keep jpg
  }
  return '.jpg';
}

async function downloadFile(url, destPath) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30 * 1000);
  const cookie = instagramCookieHeader();
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Referer: 'https://www.instagram.com/',
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });
    if (!response.ok) {
      throw new Error(`image HTTP ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) {
      throw new Error('empty image');
    }
    fs.writeFileSync(destPath, buffer);
  } finally {
    clearTimeout(timer);
  }
}

async function downloadImages(items, jobDir) {
  fs.mkdirSync(jobDir, { recursive: true });
  const files = [];
  for (const item of items) {
    const index = String((Number(item.index) || files.length) + 1).padStart(3, '0');
    const destPath = path.join(jobDir, `${index}_${item.id || 'img'}${extFromUrl(item.url)}`);
    try {
      await downloadFile(item.url, destPath);
      files.push(destPath);
    } catch (error) {
      console.warn('[image]', error.message);
    }
  }
  return files;
}

module.exports = {
  downloadImages,
};

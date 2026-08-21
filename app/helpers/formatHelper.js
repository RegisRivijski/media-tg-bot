const { languageLabel } = require('../constants/languages');
const { RESOLUTION_STEPS } = require('../constants/download');

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp']);

function normalizeLang(value) {
  if (!value || value === 'none' || value === 'und') {
    return '';
  }
  return String(value).toLowerCase().split('-')[0];
}

function isVideoOnly(format) {
  return Boolean(format.vcodec && format.vcodec !== 'none' && (!format.acodec || format.acodec === 'none'));
}

function isAudioLike(format) {
  return Boolean(format.acodec && format.acodec !== 'none');
}

function collectLanguages(info) {
  const byCode = new Map();
  const formats = info.formats || [];

  formats.forEach((format) => {
    if (isVideoOnly(format) || !isAudioLike(format)) {
      return;
    }
    const code = normalizeLang(format.language);
    if (!code) {
      return;
    }
    if (!byCode.has(code)) {
      const displayName = format.audio_track?.display_name || format.format_note;
      byCode.set(code, {
        code,
        label: languageLabel(code, displayName),
      });
    }
  });

  if (!byCode.size && info.language) {
    const code = normalizeLang(info.language);
    if (code) {
      byCode.set(code, { code, label: languageLabel(code) });
    }
  }

  return [...byCode.values()];
}

function snapHeight(height) {
  if (height >= 1080) {
    return 1080;
  }
  if (height >= 720) {
    return 720;
  }
  if (height >= 480) {
    return 480;
  }
  if (height >= 360) {
    return 360;
  }
  return height;
}

function collectResolutions(info) {
  const heights = new Set();
  (info.formats || []).forEach((format) => {
    if (!format.height || format.vcodec === 'none') {
      return;
    }
    heights.add(snapHeight(format.height));
  });
  if (!heights.size && info.height) {
    heights.add(snapHeight(info.height));
  }

  const available = RESOLUTION_STEPS.filter((step) => heights.has(step));
  if (available.length) {
    return available;
  }
  return [...heights].filter((height) => Number.isFinite(height)).sort((a, b) => a - b);
}

function defaultLanguage(languages, userLang) {
  if (!languages.length) {
    return '';
  }
  const preferred = normalizeLang(userLang);
  const matchUser = languages.find((item) => item.code === preferred);
  if (matchUser) {
    return matchUser.code;
  }
  const matchRu = languages.find((item) => item.code === 'ru');
  if (matchRu) {
    return matchRu.code;
  }
  const matchUk = languages.find((item) => item.code === 'uk');
  if (matchUk) {
    return matchUk.code;
  }
  return languages[0].code;
}

function defaultResolution(resolutions, preferredHeight) {
  if (!resolutions.length) {
    return preferredHeight || 720;
  }
  const preferred = preferredHeight || 720;
  const exact = resolutions.find((height) => height === preferred);
  if (exact) {
    return exact;
  }
  const lower = [...resolutions].reverse().find((height) => height <= preferred);
  return lower || resolutions[resolutions.length - 1];
}

function buildFormatSelector({ height, language }) {
  const h = Number(height) || 720;
  const lang = language ? `[language^=${language}]` : '';
  return [
    `bv*[height<=${h}][ext=mp4][vcodec^=avc1]+ba${lang}`,
    `bv*[height<=${h}][vcodec^=avc1]+ba${lang}`,
    `bv*[height<=${h}][vcodec*=avc]+ba${lang}`,
    `bv*[height<=${h}][ext=mp4]+ba${lang}`,
    `bv*[height<=${h}]+ba${lang}`,
    `b[height<=${h}][vcodec!=none]${lang}`,
    `bv*[height<=${h}]+ba`,
    `b[height<=${h}][vcodec!=none]`,
    'b[vcodec!=none]',
    'best[vcodec=none]',
    'best',
  ].join('/');
}

function buildAudioFormatSelector(language) {
  const lang = language ? `[language^=${language}]` : '';
  return [
    `ba${lang}[ext=m4a]`,
    `ba${lang}`,
    'ba',
    'b',
  ].join('/');
}

function hasPlayableVideo(info) {
  const formats = info.formats || [];
  return formats.some((format) => format.vcodec && format.vcodec !== 'none');
}

function isImageInfo(info) {
  if (!info) {
    return true;
  }
  const ext = String(info.ext || '').toLowerCase();
  if (IMAGE_EXTS.has(ext)) {
    return true;
  }
  if (hasPlayableVideo(info)) {
    return false;
  }
  if ((Number(info.duration) || 0) > 1) {
    return false;
  }
  if (info.vcodec === 'none' && (!info.acodec || info.acodec === 'none')) {
    return true;
  }
  return Boolean(
    info.thumbnail
    || (info.thumbnails && info.thumbnails.length)
    || !(info.formats && info.formats.length),
  );
}

function isLiveInfo(info) {
  return Boolean(info.is_live || info.live_status === 'is_live');
}

function flattenEntries(info) {
  if (!Array.isArray(info.entries) || !info.entries.length) {
    return [info];
  }
  return info.entries.map((entry, index) => entry || {
    id: `${info.id || 'item'}_${index + 1}`,
    thumbnails: info.thumbnails || [],
  });
}

function maxDuration(info) {
  return flattenEntries(info).reduce((max, entry) => {
    const duration = Number(entry.duration) || 0;
    return duration > max ? duration : max;
  }, Number(info.duration) || 0);
}

function isAlbumInfo(info) {
  return flattenEntries(info).length > 1;
}

function isImagesOnly(info) {
  const entries = flattenEntries(info);
  return Boolean(entries.length && entries.every((entry) => isImageInfo(entry)));
}

function collectImageItems(info) {
  const items = flattenEntries(info).map((entry, index) => {
    if (!isImageInfo(entry)) {
      return null;
    }
    const url = largestImageUrl(entry);
    if (!url) {
      return null;
    }
    return {
      index,
      id: entry.id || String(index + 1),
      url,
    };
  }).filter(Boolean);
  if (items.length) {
    return items;
  }
  const url = largestImageUrl(info);
  if (!url) {
    return [];
  }
  return [{ index: 0, id: info.id || 'img', url }];
}

function largestImageUrl(entry) {
  const candidates = [];
  (entry.thumbnails || []).forEach((thumb) => {
    if (thumb && thumb.url) {
      candidates.push(thumb);
    }
  });
  if (entry.thumbnail) {
    candidates.push({
      url: entry.thumbnail,
      width: entry.width,
      height: entry.height,
    });
  }
  (entry.formats || []).forEach((format) => {
    const ext = String(format.ext || '').toLowerCase();
    if (format.url && IMAGE_EXTS.has(ext)) {
      candidates.push(format);
    }
  });
  if (!candidates.length) {
    return '';
  }
  candidates.sort((left, right) => {
    const area = (item) => (Number(item.width) || 0) * (Number(item.height) || 0);
    return area(right) - area(left);
  });
  return candidates[0].url;
}

function postText(info) {
  const fromInfo = String(info.description || '').trim();
  if (fromInfo) {
    return fromInfo;
  }
  const fromEntry = flattenEntries(info).find((entry) => entry && entry.description);
  return String(fromEntry?.description || '').trim();
}

function displayTitle(info) {
  const title = String(info.title || '').trim();
  if (/^(post|video|photo) by /i.test(title)) {
    return '';
  }
  return title;
}

module.exports = {
  RESOLUTION_STEPS,
  collectLanguages,
  collectResolutions,
  defaultLanguage,
  defaultResolution,
  buildFormatSelector,
  buildAudioFormatSelector,
  isImageInfo,
  isLiveInfo,
  flattenEntries,
  maxDuration,
  isAlbumInfo,
  isImagesOnly,
  collectImageItems,
  postText,
  displayTitle,
};

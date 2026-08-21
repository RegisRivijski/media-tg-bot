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
    `bv*[height<=${h}][ext=mp4]+ba${lang}`,
    `bv*[height<=${h}]+ba${lang}`,
    `b[height<=${h}]${lang}`,
    `bv*[height<=${h}]+ba`,
    `b[height<=${h}]`,
    'b',
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

function isImageInfo(info) {
  const ext = String(info.ext || '').toLowerCase();
  if (IMAGE_EXTS.has(ext)) {
    return true;
  }
  return Boolean(info.vcodec === 'none' && (!info.acodec || info.acodec === 'none'));
}

function isLiveInfo(info) {
  return Boolean(info.is_live || info.live_status === 'is_live');
}

function flattenEntries(info) {
  if (Array.isArray(info.entries) && info.entries.length) {
    return info.entries.filter(Boolean);
  }
  return [info];
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
};

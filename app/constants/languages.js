const LABELS = {
  ar: 'العربية',
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  hi: 'हिन्दी',
  id: 'Indonesia',
  it: 'Italiano',
  ja: '日本語',
  ko: '한국어',
  pl: 'Polski',
  pt: 'Português',
  ru: 'Русский',
  th: 'ไทย',
  tr: 'Türkçe',
  uk: 'Українська',
  vi: 'Tiếng Việt',
  zh: '中文',
};

function languageLabel(code, fallback) {
  const normalized = String(code || '').toLowerCase().split('-')[0];
  if (LABELS[normalized]) {
    return LABELS[normalized];
  }
  if (fallback) {
    return fallback;
  }
  return normalized ? normalized.toUpperCase() : 'Original';
}

module.exports = {
  LABELS,
  languageLabel,
};

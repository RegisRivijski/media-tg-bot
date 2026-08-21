const HTML = { parse_mode: 'HTML' };
const HTML_NO_PREVIEW = {
  parse_mode: 'HTML',
  disable_web_page_preview: true,
  link_preview_options: { is_disabled: true },
};

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function startText() {
  return [
    '<b>Brainrot Adapter</b>',
    '',
    'Кинь ссылку — адаптирую в файл.',
    'YouTube · TikTok · Instagram',
  ].join('\n');
}

function helpText() {
  return [
    '<b>Brainrot Adapter</b>',
    '',
    'Кинь ссылку. Если надо — спрошу язык и качество.',
    'Можно видео или аудио.',
  ].join('\n');
}

function lookingText() {
  return 'Адаптирую…';
}

function chooseLanguageText(title) {
  return [
    title ? `<b>${escapeHtml(title)}</b>` : '<b>Ролик</b>',
    '',
    'Язык',
  ].join('\n');
}

function chooseResolutionText(title, languageLabelValue) {
  const lines = [
    title ? `<b>${escapeHtml(title)}</b>` : '<b>Ролик</b>',
    '',
  ];
  if (languageLabelValue) {
    lines.push(escapeHtml(languageLabelValue));
  } else {
    lines.push('Качество');
  }
  return lines.join('\n');
}

function downloadingText(title) {
  return title
    ? `Адаптирую: <b>${escapeHtml(title)}</b>`
    : 'Адаптирую…';
}

function captionText({ title, platformLabel, height, languageLabelValue, audio }) {
  const bits = [
    platformLabel,
    audio ? 'аудио' : (height ? `${height}p` : ''),
    languageLabelValue,
  ].filter(Boolean);
  const lines = [];
  if (title) {
    lines.push(`<b>${escapeHtml(title)}</b>`);
  }
  if (bits.length) {
    lines.push(escapeHtml(bits.join(' · ')));
  }
  return lines.join('\n').slice(0, 1024);
}

function liveStreamText() {
  return 'Это эфир. Нужна запись.';
}

function tooLongText() {
  return 'Слишком длинный.';
}

function tooLargeText() {
  return 'Не влез. Возьми качество ниже или аудио.';
}

function busyText() {
  return 'Уже адаптирую другое.';
}

function notYourChoiceText() {
  return 'Это не твоя ссылка.';
}

function expiredText() {
  return 'Протухло. Кинь ссылку ещё раз.';
}

function cancelledText() {
  return 'Ок, без адаптации.';
}

function nothingFoundText() {
  return 'По ссылке пусто.';
}

function missingBinaryText() {
  return 'На сервере нет yt-dlp.';
}

function failedText() {
  return 'Не скачалось. Ссылка закрыта или протухла.';
}

function unknownErrorText() {
  return 'Что-то сломалось. Попробуй позже.';
}

module.exports = {
  HTML,
  HTML_NO_PREVIEW,
  escapeHtml,
  startText,
  helpText,
  lookingText,
  chooseLanguageText,
  chooseResolutionText,
  downloadingText,
  captionText,
  liveStreamText,
  tooLongText,
  tooLargeText,
  busyText,
  notYourChoiceText,
  expiredText,
  cancelledText,
  nothingFoundText,
  missingBinaryText,
  failedText,
  unknownErrorText,
};

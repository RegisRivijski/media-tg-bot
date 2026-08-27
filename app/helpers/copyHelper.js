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
    '<b>Brain Rot Adapter</b>',
    '',
    'Кинь ссылку — скачаю файлом.',
    'YouTube · TikTok · Instagram',
  ].join('\n');
}

function helpText() {
  return [
    '<b>Brain Rot Adapter</b>',
    '',
    'Кинь ссылку. Если надо — спрошу язык и качество.',
    'Можно видео, фото или аудио.',
  ].join('\n');
}

function lookingText() {
  return 'Смотрю…';
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
    ? `Качаю: <b>${escapeHtml(title)}</b>`
    : 'Качаю…';
}

function captionText({ title, postText, platformLabel, height, languageLabelValue, audio }) {
  const bits = [
    platformLabel,
    audio ? 'аудио' : (height ? `${height}p` : ''),
    languageLabelValue,
  ].filter(Boolean);
  const body = String(postText || title || '').trim();
  const meta = bits.length ? escapeHtml(bits.join(' · ')) : '';
  const lines = [];
  if (body) {
    lines.push(escapeHtml(body));
  }
  if (meta) {
    lines.push(meta);
  }
  const joined = lines.join('\n');
  if (joined.length <= 1024) {
    return joined;
  }

  const reserved = meta ? meta.length + 1 : 0;
  const budget = Math.max(0, 1024 - reserved - 1);
  const clipped = `${escapeHtml(body).slice(0, budget)}…`;
  return (meta ? `${clipped}\n${meta}` : clipped).slice(0, 1024);
}

function postBodyText(postText) {
  const body = String(postText || '').trim();
  if (!body) {
    return '';
  }
  return escapeHtml(body).slice(0, 4096);
}

function liveStreamText() {
  return 'Это эфир. Нужна запись.';
}

function tooLongText() {
  return 'Слишком длинный.';
}

function tooLargeText() {
  return 'Файл слишком большой. Возьми качество ниже или аудио.';
}

function busyText() {
  return 'Уже качаю другое.';
}

function notYourChoiceText() {
  return 'Это не твоя ссылка.';
}

function expiredText() {
  return 'Выбор устарел. Кинь ссылку ещё раз.';
}

function cancelledText() {
  return 'Ок, отменил.';
}

function nothingFoundText() {
  return 'По ссылке ничего нет.';
}

function missingBinaryText() {
  return 'На сервере нет yt-dlp.';
}

function failedText() {
  return 'Не получилось скачать. Ссылка недоступна.';
}

function unknownErrorText() {
  return 'Что-то пошло не так. Попробуй позже.';
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
  postBodyText,
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

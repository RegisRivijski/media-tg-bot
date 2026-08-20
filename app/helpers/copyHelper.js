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
    '<b>Медиа-бот</b>',
    '',
    'Кинь в чат ссылку на YouTube, Shorts, TikTok, Instagram или Reels — скачаю и отвечу файлом.',
    '',
    'Если у ролика несколько озвучек или качеств, спрошу язык и разрешение.',
    '',
    'В группе бот должен видеть сообщения: BotFather → /setprivacy → Disable, либо сделай бота админом.',
  ].join('\n');
}

function helpText() {
  return [
    '<b>Как пользоваться</b>',
    '1. Пришли ссылку на видео или рилс.',
    '2. Если спросить есть что — выбери язык озвучки и разрешение.',
    '3. Бот ответит файлом на то же сообщение.',
    '',
    'Площадки: YouTube / Shorts, TikTok, Instagram / Reels / пост.',
    'Команды: /start, /help.',
  ].join('\n');
}

function lookingText() {
  return 'Смотрю ссылку…';
}

function chooseLanguageText(title) {
  return [
    title ? `<b>${escapeHtml(title)}</b>` : '<b>Ролик</b>',
    '',
    'На каком языке скинуть?',
  ].join('\n');
}

function chooseResolutionText(title, languageLabelValue) {
  const lines = [
    title ? `<b>${escapeHtml(title)}</b>` : '<b>Ролик</b>',
    '',
  ];
  if (languageLabelValue) {
    lines.push(`Озвучка: ${escapeHtml(languageLabelValue)}`);
  }
  lines.push('В каком разрешении скинуть?');
  return lines.join('\n');
}

function downloadingText(title) {
  return title
    ? `Качаю: <b>${escapeHtml(title)}</b>`
    : 'Качаю…';
}

function captionText({ title, platformLabel, height, languageLabelValue }) {
  const bits = [platformLabel, height ? `${height}p` : '', languageLabelValue]
    .filter(Boolean);
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
  return 'Это прямой эфир, скачать нельзя. Пришли запись.';
}

function tooLongText() {
  return 'Ролик слишком длинный. Пришли шортс, рилс или ролик покороче.';
}

function tooLargeText() {
  return 'Файл не влез в лимит Telegram. Выбери разрешение пониже.';
}

function busyText() {
  return 'Уже качаю предыдущую ссылку из этого чата. Подожди немного.';
}

function notYourChoiceText() {
  return 'Это не твоя ссылка — пусть выберет тот, кто её кинул.';
}

function expiredText() {
  return 'Выбор устарел. Кинь ссылку ещё раз.';
}

function cancelledText() {
  return 'Ок, не качаю.';
}

function nothingFoundText() {
  return 'По ссылке ничего не скачалось. Проверь, что ролик открывается без логина.';
}

function missingBinaryText() {
  return 'На сервере нет yt-dlp. Поставь его и ffmpeg, потом кинь ссылку снова.';
}

function failedText() {
  return 'Не получилось скачать. Ссылка могла протухнуть, ролик закрыт или площадка временно ломает загрузку.';
}

function unknownErrorText() {
  return 'Что-то сломалось. Попробуй ещё раз через минуту.';
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

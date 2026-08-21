const { Markup } = require('telegraf');

function chunk(items, size) {
  const rows = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

function languageKeyboard(jobId, languages) {
  const buttons = languages.map((item) => (
    Markup.button.callback(item.label, `l:${jobId}:${item.code}`)
  ));
  const rows = chunk(buttons, 2);
  rows.push([Markup.button.callback('Отмена', `x:${jobId}`)]);
  return Markup.inlineKeyboard(rows);
}

function resolutionKeyboard(jobId, resolutions) {
  const buttons = resolutions.map((height) => (
    Markup.button.callback(`${height}p`, `r:${jobId}:${height}`)
  ));
  const rows = chunk(buttons, 2);
  rows.push([Markup.button.callback('Аудио', `a:${jobId}`)]);
  rows.push([Markup.button.callback('Отмена', `x:${jobId}`)]);
  return Markup.inlineKeyboard(rows);
}

function parseCallbackData(data) {
  const [action, jobId, value] = String(data || '').split(':');
  if (!action || !jobId) {
    return null;
  }
  return { action, jobId, value: value || '' };
}

module.exports = {
  languageKeyboard,
  resolutionKeyboard,
  parseCallbackData,
};

const COMMANDS = [
  { command: 'start', description: 'Что умеет бот' },
  { command: 'help', description: 'Как кидать ссылки' },
];

async function registerBotCommands(bot) {
  await bot.telegram.setMyCommands(COMMANDS);
  await bot.telegram.setMyShortDescription(
    'Кинь ссылку на YouTube, TikTok или Instagram — скачаю в чат',
  ).catch(() => {});
  await bot.telegram.setMyDescription([
    'Бот читает чат и забирает ролики по ссылкам.',
    'YouTube, Shorts, TikTok, Instagram, Reels.',
    'Если есть выбор — спросит язык озвучки и разрешение.',
  ].join('\n')).catch(() => {});
  console.info(`[telegram] registered ${COMMANDS.length} menu commands`);
}

module.exports = {
  registerBotCommands,
};

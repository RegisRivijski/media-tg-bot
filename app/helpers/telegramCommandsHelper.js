const COMMANDS = [
  { command: 'start', description: 'О боте' },
  { command: 'help', description: 'Как пользоваться' },
];

async function registerBotCommands(bot) {
  await bot.telegram.setMyCommands(COMMANDS);
  await bot.telegram.setMyShortDescription(
    'Кинь brainrot — адаптирую в файл.',
  ).catch(() => {});
  await bot.telegram.setMyDescription([
    'Brainrot Adapter превращает ролики в файлы.',
    '',
    'Кинь ссылку на YouTube, TikTok или Instagram.',
    'Верну видео или аудио.',
  ].join('\n')).catch(() => {});
  console.info(`[telegram] registered ${COMMANDS.length} menu commands`);
}

module.exports = {
  registerBotCommands,
};

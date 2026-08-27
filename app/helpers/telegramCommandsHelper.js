const COMMANDS = [
  { command: 'start', description: 'О боте' },
  { command: 'help', description: 'Как пользоваться' },
];

async function registerBotCommands(bot) {
  await bot.telegram.setMyCommands(COMMANDS);
  await bot.telegram.setMyShortDescription(
    'Кинь ссылку — верну файлом.',
  ).catch(() => {});
  await bot.telegram.setMyDescription([
    'Brain Rot Adapter сохраняет ролики файлами.',
    '',
    'Кинь ссылку на YouTube, TikTok или Instagram.',
    'Верну видео или аудио.',
  ].join('\n')).catch(() => {});
  console.info(`[telegram] registered ${COMMANDS.length} menu commands`);
}

module.exports = {
  registerBotCommands,
};

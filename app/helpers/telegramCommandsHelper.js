const COMMANDS = [
  { command: 'start', description: 'Что умеет бот' },
  { command: 'help', description: 'Как кидать ссылки' },
];

async function registerBotCommands(bot) {
  await bot.telegram.setMyCommands(COMMANDS);
  await bot.telegram.setMyShortDescription(
    'Кинь brainrot-ссылку — верну файлом. YouTube, TikTok, Instagram.',
  ).catch(() => {});
  await bot.telegram.setMyDescription([
    'Brainrot Adapter забирает ролики из чата и кидает их файлом, чтобы не открывать YouTube, TikTok и Instagram.',
    '',
    'Кинь ссылку на видео, шортс, тикток, пост или рилс. Если есть несколько озвучек или качеств — спрошу язык и разрешение.',
  ].join('\n')).catch(() => {});
  console.info(`[telegram] registered ${COMMANDS.length} menu commands`);
}

module.exports = {
  registerBotCommands,
};

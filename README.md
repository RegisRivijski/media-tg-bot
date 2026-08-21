# media-tg-bot

Telegram-бот: читает сообщения в чате, и если кто-то кинул ссылку на YouTube / Shorts, TikTok, Instagram-пост или Reels — скачивает ролик и отвечает файлом.

Если у видео несколько озвучек или качеств, бот сначала спросит язык и разрешение. Короткие ролики (шортс, рилс, тикток до ~90 секунд) качает сразу в 720p, без лишних кнопок.

Архитектура как у `gacha-simulator-rest` и `minecraft-tg-bot`, но на CommonJS (`require` / `module.exports`), без `import`/`export`.

## Что умеет

- Ловит ссылки в тексте и в подписи к сообщению
- YouTube, Shorts, TikTok, Instagram (пост / reel / IGTV)
- Спрашивает язык озвучки, если yt-dlp видит несколько аудиодорожек
- Спрашивает разрешение (360 / 480 / 720 / 1080), если ролик длиннее 90 секунд
- Отвечает на исходное сообщение видео или альбомом фото
- Ходит в локальный Telegram Bot API, если заданы `TELEGRAM_BOT_API_*` (файлы больше 50 МБ)

В группе бот должен **видеть все сообщения**: BotFather → `/setprivacy` → Disable, либо сделай бота админом.

## Структура

Тонкий вход, логика в `app/`.

```
index.js                 # старт: require('./app')
app/
  index.js               # Telegraf, middleware, launch
  routes/                # команды и апдейты → controllers
  controllers/           # /start, /help, ссылки, callback-кнопки
  helpers/               # ссылки, yt-dlp, сессии, отправка, тексты
  middlewares/           # ошибки
  constants/             # площадки, языки, лимиты загрузки
config/
  default.js             # токен и локальный Bot API из окружения
```

Как читать код:

1. Сообщение приходит → `app/routes/index.js`
2. `mediaController` достаёт ссылку через `linkHelper`
3. `downloadJobHelper` спрашивает yt-dlp, что это за ролик
4. Если есть выбор — inline-кнопки; если нет — сразу качает
5. Файл уходит ответом в тот же чат, временные файлы удаляются

Проект **не** читает `.env`. Переменные задаются в shell, systemd или Docker.

## Установка

Нужны Node.js 18+, [yt-dlp](https://github.com/yt-dlp/yt-dlp) и ffmpeg в `PATH`.

macOS:

```bash
brew install yt-dlp ffmpeg
```

Клон и зависимости:

```bash
cd media-tg-bot
npm install
```

Токен бота:

```bash
export MEDIA_TG_BOT_API_TOKEN=your_telegram_bot_token
```

Опционально локальный Bot API (как у остальных ботов на VPS):

```bash
export TELEGRAM_BOT_API_PROTOCOL=http:
export TELEGRAM_BOT_API_HOST=172.17.0.1
export TELEGRAM_BOT_API_PORT=8081
```

Запуск:

```bash
npm start
```

Для разработки: `npm run dev` (`node --watch`).

### Переменные

| Переменная | Зачем |
| --- | --- |
| `MEDIA_TG_BOT_API_TOKEN` | токен BotFather |
| `TELEGRAM_BOT_API_PROTOCOL` | `http:` для локального Bot API |
| `TELEGRAM_BOT_API_HOST` | хост локального API, например `172.17.0.1` |
| `TELEGRAM_BOT_API_PORT` | порт, обычно `8081` |
| `UMAMI_HOST` | origin Umami, например `http://umami:3000/umami` |
| `UMAMI_WEBSITE_ID_MEDIA` | UUID сайта в Umami; без него аналитика молчит |

Лимиты, скорость скачивания, качество, таймауты и путь к cookies — в `app/constants/download.js`. Instagram/YouTube без cookies часто не отдаются: Netscape `cookies.txt` в `~/apps/media-tg-bot-cookies/cookies.txt` (в контейнере это `/cookies/cookies.txt`).

## Docker

`Dockerfile` ставит Node 20, python3, ffmpeg и свежий yt-dlp. Токен и остальной env — снаружи, как у `minecraft-tg-bot`.

На VPS сервис уже в `vps-devel/prod/docker-compose.yml`. Cookies (если нужны) клади в `~/apps/media-tg-bot-cookies/cookies.txt`. После правки `production.env`:

```bash
cd prod
docker compose up -d --build media-tg-bot
```

## Команды

| Команда | Что делает |
| --- | --- |
| `/start` | коротко, зачем бот |
| `/help` | как кидать ссылки |

Остальное — просто ссылка в чат, без команды.

## Технологии

- Node.js — runtime, CommonJS
- Telegraf — Telegram bot
- yt-dlp + ffmpeg — скачивание и сборка mp4

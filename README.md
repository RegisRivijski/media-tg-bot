# media-tg-bot

Telegram bot that watches a chat for YouTube / Shorts, TikTok, Instagram post, or Reels links, downloads the media, and replies with the file.

If a video has several audio tracks or qualities, the bot asks for language and resolution first. Short clips (Shorts, Reels, TikTok up to ~90 seconds) download at 720p with no extra buttons.

Layout matches `minecraft-tg-bot`, but this project is CommonJS (`require` / `module.exports`), not ESM.

## Features

- Picks up links in message text and captions
- YouTube, Shorts, TikTok, Instagram (post / reel / IGTV)
- Asks for an audio language when yt-dlp sees more than one track
- Asks for resolution (360 / 480 / 720 / 1080) when the clip is longer than 90 seconds
- Replies to the original message with video or a photo album
- Uses a local Telegram Bot API when `TELEGRAM_BOT_API_*` are set (files larger than 50 MB)

In a group the bot must **see every message**: BotFather → `/setprivacy` → Disable, or make the bot an admin.

## Structure

Thin entrypoint; logic lives in `app/`.

```
index.js                 # start: require('./app')
app/
  index.js               # Telegraf, middleware, launch
  routes/                # commands and updates → controllers
  controllers/           # /start, /help, links, callback buttons
  helpers/               # links, yt-dlp, sessions, send, copy
  middlewares/           # errors
  constants/             # platforms, languages, download limits
config/
  default.js             # token and local Bot API from the environment
```

How to read the code:

1. A message arrives → `app/routes/index.js`
2. `mediaController` extracts the link with `linkHelper`
3. `downloadJobHelper` asks yt-dlp what the clip is
4. If there is a choice — inline buttons; otherwise it downloads immediately
5. The file is sent back in the same chat; temp files are deleted

This project does **not** load a `.env` file. Set variables in the shell, systemd, or Docker.

## Installation

Needs Node.js 18+, [yt-dlp](https://github.com/yt-dlp/yt-dlp), and ffmpeg on `PATH`.

macOS:

```bash
brew install yt-dlp ffmpeg
```

Clone and install:

```bash
git clone https://github.com/RegisRivijski/media-tg-bot.git
cd media-tg-bot
npm install
```

Bot token:

```bash
export MEDIA_TG_BOT_API_TOKEN=your_telegram_bot_token
```

Optional local Bot API (files over 50 MB):

```bash
export TELEGRAM_BOT_API_PROTOCOL=http:
export TELEGRAM_BOT_API_HOST=127.0.0.1
export TELEGRAM_BOT_API_PORT=8081
```

Start:

```bash
npm start
```

For development: `npm run dev` (`node --watch`).

### Environment

| Variable | Purpose |
| --- | --- |
| `MEDIA_TG_BOT_API_TOKEN` | BotFather token |
| `TELEGRAM_BOT_API_PROTOCOL` | `http:` for a local Bot API |
| `TELEGRAM_BOT_API_HOST` | Local API host, e.g. `127.0.0.1` |
| `TELEGRAM_BOT_API_PORT` | Port, usually `8081` |
| `UMAMI_HOST` | Umami origin, e.g. `http://umami:3000/umami` |
| `UMAMI_WEBSITE_ID_MEDIA` | Umami website UUID; analytics is silent without it |

Limits, download rate, quality, timeouts, and the cookies path live in `app/constants/download.js`. Instagram/YouTube often fail without cookies: put a Netscape `cookies.txt` at `/cookies/cookies.txt` in the container (or set that path on the host).

## Docker

The `Dockerfile` installs Node 20, python3, ffmpeg, and a current yt-dlp. Pass the token and the rest of the env from outside, same as `minecraft-tg-bot`.

```bash
docker build -t media-tg-bot .
docker run --rm -e MEDIA_TG_BOT_API_TOKEN=your_telegram_bot_token media-tg-bot
```

## Commands

| Command | Description |
| --- | --- |
| `/start` | Short intro |
| `/help` | How to send links |

Anything else is just a link in the chat, no command.

## Technologies

- Node.js — runtime, CommonJS
- Telegraf — Telegram bot
- yt-dlp + ffmpeg — download and mux mp4

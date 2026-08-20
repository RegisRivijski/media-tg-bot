FROM node:20-alpine
MAINTAINER "Artur Petrov petrov0397@gmail.com"

RUN apk --no-cache upgrade && \
    apk --no-cache add tzdata python3 ffmpeg ca-certificates wget && \
    cp /usr/share/zoneinfo/Europe/Kyiv /etc/localtime && \
    echo "Europe/Kyiv" > /etc/timezone && \
    wget -O /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    apk del wget

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

ENTRYPOINT ["npm", "run", "start"]

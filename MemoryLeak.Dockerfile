FROM node:23.10.0-alpine3.21

RUN apk add --no-cache \
    chromium=135.0.7049.95-r0 \
    make=4.4.1-r2 \
    g++=14.2.0-r4 \
    && npm install -g pnpm@10.6.5

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install

CMD ["tail", "-f", "/dev/null"]

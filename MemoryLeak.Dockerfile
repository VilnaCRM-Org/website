FROM node:23.10.0-alpine3.21

RUN apk add --no-cache \
    chromium \
    python3 \
    make \
    g++ \
    ttf-freefont \
    udev \
    && npm install -g pnpm@10.6.5

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install

CMD ["tail", "-f", "/dev/null"]

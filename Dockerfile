FROM node:23-alpine3.20

RUN apk add --no-cache \
    python3 \
    build-base \
    make \
    g++ \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    chromium \
    nodejs \
    chromium-chromedriver \
    && npm install -g pnpm@10.4.1

WORKDIR /app

COPY . .

RUN make install

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN pnpm add puppeteer@latest

# Add user so we don't need --no-sandbox.
RUN addgroup -S pptruser && adduser -S -G pptruser pptruser \
    && mkdir -p /home/pptruser/Downloads /app \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /app

# Run everything after as non-privileged user.
USER pptruser

EXPOSE 3001

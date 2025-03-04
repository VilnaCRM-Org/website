FROM node:23-alpine3.20

WORKDIR /app

COPY package.json pnpm-lock.yaml checkNodeVersion.js ./
COPY .puppeteerrc.cjs ./.puppeteerrc.cjs

RUN npm install -g pnpm && pnpm install

COPY . .

# Install Chromium and Puppeteer dependencies (without downloading Chrome through Puppeteer)
RUN apk add --no-cache \
          chromium \
          nss \
          freetype \
          harfbuzz \
          ca-certificates \
          ttf-freefont \
          nodejs \
          yarn \
        && rm -rf /var/cache/apk/*

#chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN pnpm install puppeteer && \
     npx puppeteer browsers install chrome@127.0.6533.88

RUN addgroup -S pptruser && adduser -S -G pptruser pptruser \
    && mkdir -p /home/pptruser/Downloads /app \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /app

USER pptruser

CMD ["sh", "-c", "node ./src/test/memory-leak/runMemlabTests.js"]

FROM node:23-alpine3.19

# Install dependencies
RUN apk add --no-cache \
    udev \
    ttf-freefont \
    chromium \
    python3 \
    make \
    g++ \
    && npm install -g pnpm

ENV PUPPETEER_CONFIG_FILE="/app/.puppeteerrc.cjs" \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium


WORKDIR /app

COPY .puppeteerrc.cjs /app/.puppeteerrc.cjs
COPY . .
RUN make install


CMD ["node", "src/test/memory-leak/runMemlabTests.js"]
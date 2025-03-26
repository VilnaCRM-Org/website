FROM node:23-alpine3.20

RUN apk add --no-cache \
    udev \
    ttf-freefont \
    chromium \
    python3=3.10.* \
    make=4.3* \
    g++=4:11.* \
    && npm install -g pnpm@10.6.5

WORKDIR /app
COPY .puppeteerrc.cjs /app/.puppeteerrc.cjs
COPY . .

ENV PUPPETEER_CONFIG_FILE="/app/.puppeteerrc.cjs" \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN make install

# Cleanup old profile locks and ensure proper directory permissions
RUN rm -rf /tmp/chromium/Singleton* /tmp/chromium/Lock /tmp/chromium/Default/Singleton* && \
    mkdir -p /tmp/chromium && chown -R root:root /tmp/chromium

# Ensure no lingering Chromium processes
RUN pkill -o chromium || true

# Create Chromium profile directory
RUN mkdir -p /root/.config/chromium/docker-chromium-profile && chown -R root:root /root/.config/chromium

CMD ["sh", "-c", "pkill -o chromium || true && node src/test/memory-leak/runMemlabTests.js"]

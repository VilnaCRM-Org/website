FROM node:23.11.1-alpine3.21

RUN apk add --no-cache \
    udev \
    ttf-freefont \
    chromium \
    python3\
    make \
    g++ \
    && npm install -g pnpm@10.6.5

WORKDIR /app
COPY package.json pnpm-lock.yaml checkNodeVersion.js ./


RUN pnpm install

RUN rm -rf /tmp/chromium/Singleton* /tmp/chromium/Lock /tmp/chromium/Default/Singleton* && \
    mkdir -p /tmp/chromium && chown -R root:root /tmp/chromium

RUN mkdir -p /root/.config/chromium/docker-chromium-profile && chown -R root:root /root/.config/chromium

CMD ["sh", "-c", "pkill -o chromium || true && node src/test/memory-leak/runMemlabTests.js"]

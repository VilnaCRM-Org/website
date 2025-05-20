FROM node:23.11.1-alpine3.21

RUN apk add --no-cache \
    chromium=136.0.7103.113-r0 \
    make=4.4.1-r2 \
    g++=14.2.0-r4\
    xvfb \
    libstdc++=14.2.0-r4 \
    nss=3.109-r0 \
    freetype=2.13.3-r0 \
    harfbuzz=9.0.0-r1 \
    ca-certificates=20241121-r1 \
    ttf-freefont=20120503-r4 \
    && npm install -g pnpm@10.11.0

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install

RUN addgroup -S appuser && adduser -S appuser -G appuser
RUN chown -R appuser:appuser /app
USER appuser

CMD ["sleep","infinity"]

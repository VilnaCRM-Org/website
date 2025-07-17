FROM node:23.11.1-alpine3.21 AS base


RUN apk add --no-cache \
    ca-certificates=20241121-r1 \
    chromium=136.0.7103.113-r0 \
    dbus=1.14.10-r4 \
    freetype=2.13.3-r0 \
    harfbuzz=9.0.0-r1 \
    libx11=1.8.10-r0 \
    libxcomposite=0.4.6-r5 \
    libxdamage=1.1.6-r5 \
    libxext=1.3.6-r2 \
    nss=3.109-r0 \
    ttf-freefont=20120503-r4 \
    xvfb=21.1.16-r0 && \
    npm install -g pnpm@10.11.0

ENV DISPLAY=:99 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    NEXT_PUBLIC_MAIN_LANGUAGE=uk \
    NEXT_PUBLIC_FALLBACK_LANGUAGE=en

WORKDIR /app


RUN addgroup -S appgroup && adduser -S appuser -G appgroup

FROM base AS build

COPY package.json pnpm-lock.yaml checkNodeVersion.js ./
RUN pnpm install

FROM base AS final

WORKDIR /app

COPY --from=build --chown=appuser:appgroup /app/node_modules ./node_modules

COPY --chown=appuser:appgroup src/test/memory-leak ./src/test/memory-leak
COPY --chown=appuser:appgroup src/config/i18nConfig.js ./src/config/i18nConfig.js
COPY --chown=appuser:appgroup pages/i18n/localization.json ./pages/i18n/localization.json


USER appuser


HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ps aux | grep -q '[s]leep infinity' || exit 1

CMD ["sleep","infinity"]

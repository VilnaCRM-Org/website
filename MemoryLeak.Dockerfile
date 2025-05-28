FROM node:23.11.1-alpine3.21 AS base

RUN apk add --no-cache \
    chromium=136.0.7103.113-r0 \
    xvfb-run=1.20.10.3-r2 \
    nss=3.109-r0 \
    freetype=2.13.3-r0 \
    harfbuzz=9.0.0-r1 \
    ca-certificates=20241121-r1 \
    ttf-freefont=20120503-r4 \
    xvfb=21.1.16-r0 \
    dbus=1.14.10-r4 \
    libx11=1.8.10-r0 \
    libxcomposite=0.4.6-r5 \
    libxdamage=1.1.6-r5 \
    libxext=1.3.6-r2 \
    && npm install -g pnpm@10.11.0

ENV DISPLAY=:99 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    NEXT_PUBLIC_MAIN_LANGUAGE=uk \
    NEXT_PUBLIC_FALLBACK_LANGUAGE=en

WORKDIR /app

# ---------- Build Stage ----------
FROM base AS build

COPY package.json pnpm-lock.yaml checkNodeVersion.js ./
RUN pnpm install

# ---------- Final Stage ----------
FROM base AS final

WORKDIR /app
COPY --from=build /app/node_modules ./node_modules

COPY src/test/memory-leak ./src/test/memory-leak
COPY src/config/i18nConfig.js ./src/config/i18nConfig.js
COPY pages/i18n/localization.json ./pages/i18n/localization.json

CMD ["tail", "-f", "/dev/null"]

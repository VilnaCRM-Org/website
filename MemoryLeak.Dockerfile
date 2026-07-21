FROM public.ecr.aws/docker/library/node:24.18.0-alpine3.23 AS base

RUN apk add --no-cache \
    chromium=149.0.7827.53-r0 \
    xvfb=21.1.23-r0 \
    nss=3.123.1-r0 \
    freetype=2.14.3-r0 \
    harfbuzz=12.2.0-r0 \
    ca-certificates=20260611-r0 \
    ttf-freefont=20120503-r4 \
    dbus=1.16.2-r1 \
    libx11=1.8.12-r1 \
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


FROM base AS build

COPY package.json pnpm-lock.yaml checkNodeVersion.js ./
RUN pnpm install


FROM base AS final

WORKDIR /app
COPY --from=build /app/node_modules ./node_modules

COPY src/test/memory-leak ./src/test/memory-leak
COPY scripts/localizationGenerator.js ./scripts/localizationGenerator.js
COPY src/features ./src/features

# localization.json is a gitignored build artifact (#328), so generate it in the
# image from the per-feature i18n sources instead of copying a committed file.
RUN node -e "new (require('./scripts/localizationGenerator'))().generateLocalizationFile()"

CMD ["sleep","infinity"]

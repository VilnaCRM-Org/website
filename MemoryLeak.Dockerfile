FROM public.ecr.aws/docker/library/node:25.2.1-alpine3.21 AS base

RUN apk add --no-cache \
    chromium=136.0.7103.113-r0 \
    xvfb=21.1.16-r0 \
    nss=3.109-r0 \
    freetype=2.13.3-r0 \
    harfbuzz=9.0.0-r1 \
    ca-certificates=20260413-r0 \
    ttf-freefont=20120503-r4 \
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

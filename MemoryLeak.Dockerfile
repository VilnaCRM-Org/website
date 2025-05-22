FROM node:23.11.1-alpine3.21

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

ENV DISPLAY=:99
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NEXT_PUBLIC_MAIN_LANGUAGE=uk
ENV NEXT_PUBLIC_FALLBACK_LANGUAGE=en

WORKDIR /app

COPY package.json pnpm-lock.yaml checkNodeVersion.js ./
RUN pnpm install

RUN addgroup -S appuser && adduser -S appuser -G appuser \
     && chown -R appuser:appuser /app
USER appuser

CMD ["sh", "-c", "rm -f /tmp/.X99-lock && Xvfb :99 -screen 0 1024x768x16 & sleep infinity"]

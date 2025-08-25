FROM mcr.microsoft.com/playwright:v1.53.1-jammy

RUN apt-get update && apt-get install -y --no-install-recommends --fix-missing \
    python3=3.10.6-1~22.04.1 \
    make=4.3-4.1build1 \
    g++=4:11.2.0-1ubuntu1 \
    curl=7.81.0-* \
    g++=4:11.2.0-1ubuntu1 \
    make=4.3-4.1build1 \
    python3=3.10.6-1~22.04.1 \
    && npm install -g pnpm@10.6.5 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*


RUN useradd -m -s /bin/bash appuser


USER appuser

WORKDIR /app

COPY package.json pnpm-lock.yaml checkNodeVersion.js ./

RUN pnpm install

# Добавление HEALTHCHECK
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s CMD curl -f http://localhost:3000 || exit 1

CMD ["tail", "-f", "/dev/null"]

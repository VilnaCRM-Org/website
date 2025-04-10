FROM mcr.microsoft.com/playwright:v1.51.0-jammy

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3=3.10.6-1~22.04.1 \
    make=4.3-4.1build1 \
    g++=4:11.2.0-1ubuntu1 \
    && npm install -g pnpm@10.6.5 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*


WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile

CMD ["tail", "-f", "/dev/null"]

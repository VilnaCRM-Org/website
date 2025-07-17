FROM node:23.11.1-alpine3.21

# Создание не-root пользователя
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Установка зависимостей в одном RUN-блоке
RUN apk add --no-cache \
    curl=8.12.1-r1 && \
    npm install -g pnpm@10.6.5 typescript@5.8.2

# Установка рабочей директории
WORKDIR /app

# Копирование необходимых файлов
COPY package.json pnpm-lock.yaml checkNodeVersion.js ./
COPY tsconfig.server.json tsconfig.server.json
COPY docker docker
COPY .env .env

# Установка зависимостей и сборка TypeScript
RUN pnpm install && \
    tsc --project tsconfig.server.json

# Установка не-root пользователя для запуска приложения
USER appuser

# Добавление HEALTHCHECK
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

# Используем exec-форму CMD (обязательно!)
CMD ["sh", "-c", "node ./out/docker/apollo-server/schemaFetcher.js && node ./out/docker/apollo-server/server.mjs"]

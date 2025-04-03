FROM node:23.10.0-alpine3.21

RUN apk add --no-cache python3=3.12.9-r0 make=4.4.1-r2 g++=14.2.0-r4 \
    && npm install -g pnpm@11.2.0

WORKDIR /app

COPY . .

RUN make install

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1
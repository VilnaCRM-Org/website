FROM mockoon/cli:9.1.0

WORKDIR /app

COPY data.ts /app/data.ts

RUN pnpm run compile-server

CMD ["mockoon-cli", "start", "--data", "/app/data.ts"]
#CMD ["mockoon-cli", "start", "--data", "out/docker/mockoon/data.js"]
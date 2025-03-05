FROM mcr.microsoft.com/playwright:v1.50.0-jammy

RUN apt-get update && apt-get install -y --no-install-recommends \
     python3 make g++ \
     && npm install -g pnpm@10.4.1 \
     && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN make install

CMD ["tail", "-f", "/dev/null"]

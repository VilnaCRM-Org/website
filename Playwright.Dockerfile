FROM mcr.microsoft.com/playwright:v1.51.0-jammy

RUN apt-get update && apt-get install -y --no-install-recommends \
     python3=3.10.* make=4.3* g++=4:11.* \
     && npm install -g pnpm@10.6.5 \
     && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN make install

CMD ["tail", "-f", "/dev/null"]

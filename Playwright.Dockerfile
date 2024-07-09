FROM mcr.microsoft.com/playwright:v1.45.1-jammy

RUN apt-get update && apt-get install -y python3 make g++ \
    && npm install -g pnpm \
    && apt-get clean

WORKDIR /app

ENV NEXT_PUBLIC_MAIN_LANGUAGE=en

COPY . .

RUN make install

CMD ["pnpm", "run", "dev"]

FROM node:20-alpine3.17

RUN apk add --no-cache python3=3.10.15-r0 make=4.3-r1 g++=12.2.1_git20220924-r4 curl=8.9.0-r0  \
    && npm install -g pnpm

WORKDIR /app

COPY . .

RUN make install
RUN rm -rf /app/out

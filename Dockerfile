FROM node:23.11.1-alpine3.21

RUN apk add --no-cache \  
      python3=3.11.6-r0 \  
      make=4.3-r0 \  
      g++=12.2.1_git20220227-r3 \  
      curl=8.2.1-r4 \  
    && corepack enable \  
    && corepack prepare pnpm@10.6.5 --activate  

WORKDIR /app

COPY package.json pnpm-lock.yaml checkNodeVersion.js ./

RUN pnpm install

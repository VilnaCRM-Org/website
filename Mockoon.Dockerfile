FROM node:23.10.0-alpine3.21

WORKDIR /app

RUN npm install -g @mockoon/cli@9.2.0 typescript@5.8.2 && \
    npm install dotenv@16.4.7 @types/node@22.13.13 @types/dotenv@8.2.3 --save-dev && \
    npm install winston @types/winston --save-dev


COPY docker/mockoon/data.ts mockoon/data.ts
COPY .env .env

##compilation
RUN tsc mockoon/data.ts --outDir out --rootDir ./ \
  --module NodeNext --moduleResolution NodeNext \
  --target ESNext --strict --resolveJsonModule \
  --experimentalDecorators --emitDecoratorMetadata \
  --esModuleInterop --allowSyntheticDefaultImports \
  --skipLibCheck --noImplicitAny --noEmitOnError \
  --lib es2018,dom  && \
  node ./out/mockoon/data.js

##create data.json
#RUN node ./out/mockoon/data.js

EXPOSE 8080

CMD ["mockoon-cli", "start", "-d", "out/mockoon/data.json"]

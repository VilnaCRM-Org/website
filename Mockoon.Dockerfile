FROM node:23-alpine3.20

WORKDIR /app

RUN npm install -g @mockoon/cli typescript && \
    npm install dotenv @types/node @types/dotenv --save-dev

COPY docker/mockoon/data.ts mockoon/data.ts

##compilation
RUN tsc mockoon/data.ts --outDir out --rootDir ./ \
  --module NodeNext --moduleResolution NodeNext \
  --target ESNext --strict --resolveJsonModule \
  --experimentalDecorators --emitDecoratorMetadata \
  --esModuleInterop --allowSyntheticDefaultImports \
  --skipLibCheck --noImplicitAny --noEmitOnError \
  --lib es2018,dom

##create data.json
RUN node ./out/mockoon/data.js

EXPOSE 8080

CMD ["mockoon-cli", "start", "-d", "out/mockoon/data.json"]

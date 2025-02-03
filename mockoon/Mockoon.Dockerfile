FROM mockoon/cli

WORKDIR /app

COPY mockoon.json /app/mockoon.json

CMD ["node", "/app/entrypoint.js"]

CMD ["mockoon-cli", "start", "--data", "/app/mockoon.json"]
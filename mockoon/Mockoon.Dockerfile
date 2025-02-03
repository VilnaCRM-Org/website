FROM mockoon/cli

WORKDIR /app

COPY mockoon.json /app/mockoon.json

CMD ["mockoon-cli", "start", "--data", "/app/mockoon.json"]

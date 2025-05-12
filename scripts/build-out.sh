#!/bin/sh

pnpm install

npx next build

echo "OUT DIR EXISTS?"; ls -la /app/out

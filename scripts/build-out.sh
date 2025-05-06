#!/bin/sh

rm -rf /app/out
mkdir -p /app/out

npx next build

npx next export

npx next-export-optimize-images

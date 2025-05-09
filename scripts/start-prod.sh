#!/bin/sh

npx next build

npx next-export-optimize-images

npx serve -s out -p 3001

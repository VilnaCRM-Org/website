#!/bin/sh
set -e

npx next build

npx next-export-optimize-images
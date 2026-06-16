#!/bin/sh
set -e

# Apply pending database migrations before starting the server.
# Call the prisma package directly — the .bin symlink gets dereferenced by
# Docker COPY, which breaks the CLI's relative lookup of its wasm engine files.
echo "▶ Running database migrations…"
node ./node_modules/prisma/build/index.js migrate deploy

echo "▶ Starting server…"
exec "$@"

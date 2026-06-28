#!/bin/sh
set -e

# Container startup sequence for the API service:
#   0. If running as root (a persistent disk mounted at runtime is owned by
#      root), take ownership of the uploads directory for the non-root 'node'
#      user, then re-exec this script as 'node' so the app never runs privileged.
#   1. Apply any pending database migrations (idempotent).
#   2. Seed baseline demo data unless explicitly disabled (idempotent via upserts).
#   3. Hand off (exec) to the Node process so it receives signals as PID 1's child.

UPLOADS_DIR="${UPLOADS_DIR:-/app/uploads}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$UPLOADS_DIR"
  chown -R node:node "$UPLOADS_DIR"
  exec su-exec node "$0" "$@"
fi

echo "[entrypoint] Applying database migrations (prisma migrate deploy)..."
node_modules/.bin/prisma migrate deploy

if [ "${SEED_ON_STARTUP:-true}" = "true" ]; then
  echo "[entrypoint] Seeding database..."
  node dist/seed.js
else
  echo "[entrypoint] SEED_ON_STARTUP is '${SEED_ON_STARTUP}'; skipping seed."
fi

echo "[entrypoint] Starting workbook-api..."
exec node dist/main.js

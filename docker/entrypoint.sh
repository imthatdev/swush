#!/bin/sh
set -e

if [ "${RUN_DB_PUSH:-true}" != "false" ] && [ -n "${DATABASE_URL:-}" ]; then
  echo "Running database push..."
  pnpm run push:db
fi

exec pnpm run start

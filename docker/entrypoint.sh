#!/bin/sh
set -e

if [ "${RUN_DB_PUSH:-true}" != "false" ] && [ -n "${DATABASE_URL:-}" ]; then
  echo "Running database push..."
  bun run push:db
fi

exec bun run start

#!/bin/sh
set -e

if [ "${RUN_DB_MIGRATIONS:-true}" != "false" ] && [ -n "${DATABASE_URL:-}" ]; then
  echo "Running database push..."
  pnpm db:migrate 
fi

exec node server.js
FROM oven/bun:1-slim AS deps
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install

FROM oven/bun:1-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production

RUN bun x next build

FROM oven/bun:1-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    UPLOAD_ROOT=/data/uploads \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    YTDLP_PATH=/usr/bin/yt-dlp

RUN apt-get update -y \
    && apt-get install -y --no-install-recommends \
        ffmpeg curl ca-certificates yt-dlp clamav clamav-daemon \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /root/.bun/install/cache /root/.cache \
    && freshclam || true

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/docker/entrypoint.sh ./docker/entrypoint.sh
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/src/db/schemas ./src/db/schemas
COPY package.json next.config.* ./

RUN mkdir -p /app/.next/cache/images /data/uploads \
    && chmod -R 755 /app/.next /data \
    && chmod +x /app/docker/entrypoint.sh

EXPOSE 3000
CMD ["/app/docker/entrypoint.sh"]

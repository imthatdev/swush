# ========================
# Stage 1: Dependencies
# ========================
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# ========================
# Stage 2: Build
# ========================
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN pnpm exec next build

# ========================
# Stage 3: Runner / Production
# ========================
FROM node:20-alpine AS runner
WORKDIR /app

# Install runtime deps
RUN apk add --no-cache \
    ffmpeg \
    curl \
    ca-certificates \
    yt-dlp \
    clamav \
    clamav-daemon \
    bash \
 && rm -rf /var/cache/apk/*

# Set environment
ENV NODE_ENV=production \
    PORT=3000 \
    UPLOAD_ROOT=/data/uploads \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    YTDLP_PATH=/usr/bin/yt-dlp

# Update ClamAV database
RUN freshclam

# Copy app files
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/docker/entrypoint.sh ./docker/entrypoint.sh

# Prepare folders & permissions
RUN mkdir -p /app/.next/cache/images /data/uploads \
    && chmod +x ./docker/entrypoint.sh

EXPOSE 3000
CMD ["node","server.js"]

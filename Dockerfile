# ========================
# Stage 1: Build
# ========================
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install dependencies and build the app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ========================
# Stage 2: Production runner
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

# Just install drizzle-kit (and any runtime peer deps needed to run migrations)
RUN corepack enable && corepack prepare pnpm@latest --activate \
    && pnpm add --prod drizzle-kit drizzle-orm pg

# Copy Next.js standalone/server output and static assets from the build stage
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy entrypoint script
COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Create and use a non-root user for runtime
RUN addgroup -S swush && adduser -S -G swush swush \
    && chown -R swush:swush /app

USER swush

EXPOSE 3000

ENV NODE_ENV=production

CMD ["./entrypoint.sh"]
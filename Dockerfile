# ─── Multi-Stage Dockerfile for PrintMagic Main App ──────────────────────
# Stage 1: Build (TypeScript & Vite)
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
COPY server ./server

RUN npm ci && npm run build

# Stage 2: Minimal Production Runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm install -g tsx

COPY --from=builder /app/dist ./dist
COPY server ./server
COPY public ./public

# Non-root user
USER node

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["tsx", "server/index.ts"]

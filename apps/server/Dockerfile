# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate

WORKDIR /app

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/speed-visualizer-sdk/package.json ./packages/speed-visualizer-sdk/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/server ./apps/server
COPY packages/speed-visualizer-sdk ./packages/speed-visualizer-sdk

# Build
RUN pnpm --filter @kas-racing/server build

# Production stage
FROM node:20-alpine AS runner

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate

WORKDIR /app

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/speed-visualizer-sdk/package.json ./packages/speed-visualizer-sdk/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files
COPY --from=builder /app/apps/server/dist ./apps/server/dist

# Set working directory to server
WORKDIR /app/apps/server

# Environment
ENV NODE_ENV=production
ENV PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

EXPOSE 8080

CMD ["node", "dist/index.js"]

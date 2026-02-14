# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate

WORKDIR /app

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/indexer/package.json ./apps/indexer/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/indexer ./apps/indexer

# Build
RUN pnpm --filter @kas-racing/indexer build

# Production stage
FROM node:20-alpine AS runner

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate

WORKDIR /app

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/indexer/package.json ./apps/indexer/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files
COPY --from=builder /app/apps/indexer/dist ./apps/indexer/dist

# Set working directory to indexer
WORKDIR /app/apps/indexer

# Environment
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]

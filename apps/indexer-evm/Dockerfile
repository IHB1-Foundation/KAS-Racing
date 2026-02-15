# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate

WORKDIR /app

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/indexer-evm/package.json ./apps/indexer-evm/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/indexer-evm ./apps/indexer-evm

# Build
RUN pnpm --filter @kas-racing/indexer-evm build

# Production stage
FROM node:20-alpine AS runner

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate

WORKDIR /app

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/indexer-evm/package.json ./apps/indexer-evm/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files
COPY --from=builder /app/apps/indexer-evm/dist ./apps/indexer-evm/dist

# Set working directory to indexer
WORKDIR /app/apps/indexer-evm

# Environment
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]

# Multi-stage build for optimized production deployment with Google Cloud PostgreSQL
# Optimized for Cloud Run, GKE, and general container deployments

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-slim AS deps

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies for build
RUN npm ci

# ============================================
# Stage 2: Builder
# ============================================
FROM node:20-slim AS builder

# Install build tools for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build frontend and backend
# This creates dist/ folder with compiled assets
RUN npm run build

# ============================================
# Stage 3: Production Runtime
# ============================================
FROM node:20-slim

# Install runtime dependencies for PostgreSQL
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create non-root user for security
RUN groupadd -r nodejs && useradd -r -g nodejs nodejs

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev) because server imports vite
# Even though vite is only used in development, the import statement runs in production
RUN npm ci && npm cache clean --force

# Copy built assets from builder stage
COPY --from=builder /app/dist ./dist

# Copy database schema and config (needed for migrations)
COPY --from=builder /app/db ./db
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Create directories for runtime with proper permissions
RUN mkdir -p server/uploads logs && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port (Cloud Run uses PORT env var, defaults to 5000)
EXPOSE 5000

# Set production environment
ENV NODE_ENV=production

# Health check for container orchestration
# Cloud Run will use this to verify the service is healthy
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 5000) + '/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
# Use exec form to properly handle signals (SIGTERM for graceful shutdown)
CMD ["npm", "start"]

# ============================================
# Build Arguments and Labels
# ============================================
ARG BUILD_DATE
ARG VERSION
LABEL org.opencontainers.image.created=$BUILD_DATE
LABEL org.opencontainers.image.version=$VERSION
LABEL org.opencontainers.image.description="Personal Group Coordinator - Collaborative Trip Planning Application"
LABEL org.opencontainers.image.vendor="PGC"

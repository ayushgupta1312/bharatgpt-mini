# ─────────────────────────────────────────
# Stage 1: Builder
# Install dependencies in a separate stage
# ─────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

# Copy only package.json first (better layer caching)
# If package.json hasn't changed, npm install is cached
COPY backend/package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# ─────────────────────────────────────────
# Stage 2: Production
# Lean final image with only what's needed
# ─────────────────────────────────────────
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy only built dependencies from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=nodejs:nodejs backend/ .
COPY --chown=nodejs:nodejs frontend/ ./frontend/

# Switch to non-root user
USER nodejs

EXPOSE 3000

# Health check built into image
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly
CMD ["dumb-init", "node", "app.js"]

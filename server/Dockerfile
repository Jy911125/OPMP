# OPMP Server - Node.js Backend
FROM node:20-alpine

LABEL maintainer="OPMP Team"
LABEL description="OPMP Virtual Digital Monitoring Platform - Server"

# Install required system packages
RUN apk add --no-cache \
    curl \
    bash \
    procps \
    sudo

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Create log directory
RUN mkdir -p /var/log/opmp && chmod 777 /var/log/opmp

# Create non-root user (but keep access to docker socket)
RUN addgroup -S opmp && adduser -S opmp -G opmp
RUN echo "opmp ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/bin/docker-compose" >> /etc/sudoers

# Environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start server
USER opmp
CMD ["node", "dist/app.js"]

# OPMP Client - Vue 3 Frontend
FROM node:20-alpine AS builder

LABEL maintainer="OPMP Team"
LABEL description="OPMP Virtual Digital Monitoring Platform - Client Builder"

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src
COPY public ./public
COPY index.html ./

# Build for production
RUN npm run build

# Production stage - Nginx
FROM nginx:alpine

LABEL maintainer="OPMP Team"
LABEL description="OPMP Virtual Digital Monitoring Platform - Client"

# Install useful tools
RUN apk add --no-cache curl

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:80/health || exit 1

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

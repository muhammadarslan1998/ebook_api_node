# Use official Node.js Debian Bookworm slim image
FROM node:22-bookworm-slim

# Install Calibre and essential fonts for eBook rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    calibre \
    fonts-liberation \
    fonts-dejavu-core \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package manifests first for efficient layer caching
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Create uploads and converted directories with correct permissions
RUN mkdir -p uploads converted

# Set environment defaults
ENV PORT=3000
ENV NODE_ENV=production
ENV MAX_FILE_SIZE_MB=100
ENV CALIBRE_BIN=/usr/bin/ebook-convert
ENV CALIBRE_DEBUG_BIN=/usr/bin/calibre-debug

# Expose server port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]

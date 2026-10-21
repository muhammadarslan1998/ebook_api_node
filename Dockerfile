# Use official Node.js Debian Bookworm slim image
FROM node:22-bookworm-slim

# Install Calibre and essential fonts for eBook rendering (covering Indic, CJK, Thai, Ethiopic, Arabic, Cyrillic, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    calibre \
    fontconfig \
    fonts-liberation \
    fonts-dejavu-core \
    fonts-noto-cjk \
    fonts-noto-core \
    fonts-noto-extra \
    fonts-indic \
    fonts-thai-tlwg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package manifests and scripts first for layer caching & postinstall hooks
COPY package*.json ./
COPY scripts/ ./scripts/

# Install production dependencies
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Register bundled Google fonts into system font cache for Calibre and system fontconfig
RUN mkdir -p /usr/local/share/fonts/ebook-fonts && \
    cp assets/fonts/*.ttf /usr/local/share/fonts/ebook-fonts/ 2>/dev/null || true && \
    fc-cache -f

# Explicitly run FontKit patch to guarantee complex-script layout safety
RUN node scripts/patch-fontkit.js

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

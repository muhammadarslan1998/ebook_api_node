FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    calibre \
    fontconfig \
    fonts-noto-core \
    fonts-noto-cjk \
    fonts-noto-extra \
    fonts-noto-color-emoji \
    fonts-dejavu-core \
    fonts-freefont-ttf \
    && fc-cache -f -v \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
RUN mkdir -p storage/uploads storage/outputs storage/tmp && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["npm","start"]

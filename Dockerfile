FROM node:20-bookworm-slim

# FFmpeg + 한국어 폰트 + canvas 빌드 의존성
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fonts-noto-cjk \
    libcairo2-dev \
    libpango1.0-dev \
    libpng-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN mkdir -p uploads output

EXPOSE 3333
ENV NODE_ENV=production

CMD ["node", "server.js"]

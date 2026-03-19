FROM node:20-alpine

ARG CACHE_BUST=4
WORKDIR /app

# Install ffmpeg, python3 and pip for yt-dlp
RUN apk add --no-cache ffmpeg python3 py3-pip && echo "rebuild-v3-$(date +%s)" > /tmp/build_marker
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp

# Copy package files for root (frontend build)
COPY package*.json ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY tsconfig.app.json ./
COPY index.html ./

# Copy server package files
COPY server/package*.json ./server/
COPY server/tsconfig.json ./server/

# Install dependencies for both frontend and server
RUN npm install && cd server && npm install

# Copy source files
COPY src ./src/
COPY public ./public/
COPY server/src ./server/src/

# Build frontend
RUN npm run build

# Build server
RUN cd server && npm run build

EXPOSE 3000

CMD ["sh", "-c", "cd server && npm start"]

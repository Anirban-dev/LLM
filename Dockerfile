# Multi-stage Dockerfile for WhatsApp Web AI Application

# Stage 1: Build Application
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy full source code
COPY . .

# Build Vite frontend and bundled Node server
RUN npm run build

# Stage 2: Production Runtime
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy built distribution assets and package definition
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Create uploads directory for audio files
RUN mkdir -p /app/uploads

EXPOSE 3000

CMD ["node", "dist/server.cjs"]

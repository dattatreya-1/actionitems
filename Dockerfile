### Build stage - Frontend
FROM node:18 AS build-frontend
WORKDIR /app

# Copy package files and install all dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy frontend source and build
COPY . .
RUN npm run build
RUN test -f dist/index.html || (echo "dist/index.html not found — build failed" && exit 1)

### Production image
FROM node:18-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy package files and install production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Copy server source code
COPY server/ ./server/

# Copy built frontend from build stage
COPY --from=build-frontend /app/dist ./dist

# Cloud Run uses PORT environment variable
EXPOSE 8080

# Start the backend server (which serves the frontend)
CMD ["node", "server/index.js"]

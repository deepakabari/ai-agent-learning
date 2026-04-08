# ============================================
# Stage 1: Development (with hot reload)
# ============================================
FROM node:24-alpine AS development

WORKDIR /app

COPY package*.json ./
RUN apk add --no-cache git
RUN npm ci

COPY . .

EXPOSE 3001
CMD ["npm", "run", "dev"]

# ============================================
# Stage 2: Build
# ============================================
FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ============================================
# Stage 3: Production (slim image)
# ============================================
FROM node:24-alpine AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

COPY package*.json ./
RUN apk add --no-cache git
RUN npm ci --omit=dev && \
    npm cache clean --force

COPY --from=build /app/dist ./dist

USER appuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/healthz').then(r => process.exit(r.ok ? 0 : 1))"

CMD ["node", "dist/src/server.js"]

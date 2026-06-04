# ---- Build Stage ----
FROM node:18-alpine AS builder

WORKDIR /app

COPY . .

RUN npm ci
RUN npm run build

# ---- Production Stage ----
FROM node:18-alpine AS production

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY --from=builder --chown=nodejs:nodejs /app /app

USER nodejs

EXPOSE 80

CMD ["node", "dist/server.js"]
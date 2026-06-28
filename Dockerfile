# syntax=docker/dockerfile:1

############################
# Stage 1: dependencies
############################
FROM node:22-alpine AS deps
WORKDIR /app
# Prisma needs OpenSSL at build time to generate the engine binaries.
RUN apk add --no-cache openssl
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

############################
# Stage 2: build
############################
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build
# Drop dev dependencies for a lean runtime image.
RUN npm prune --omit=dev

############################
# Stage 3: runtime
############################
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl

# Run as the non-root user shipped with the base image.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/package.json ./package.json

USER node
EXPOSE 3000

# Apply pending migrations, then boot the API.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]

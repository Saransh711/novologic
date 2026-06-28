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
# `prisma generate` loads prisma.config.ts, which resolves DATABASE_URL eagerly.
# Generation never connects to a database, so a placeholder satisfies the config
# loader at build time; the real URL is injected at runtime via the environment.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build
# Compile the standalone seed script to plain JS so it can run in the lean
# runtime image without dev tooling (tsx). It only needs the Prisma client and
# pg adapter, which are production dependencies.
RUN npx tsc prisma/seed.ts --ignoreConfig --outDir dist \
    --module node16 --moduleResolution node16 --target ES2023 \
    --esModuleInterop --skipLibCheck
# Drop dev dependencies for a lean runtime image. The Prisma CLI and dotenv are
# production dependencies, so `migrate deploy` and config loading still work.
RUN npm prune --omit=dev

############################
# Stage 3: runtime
############################
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# openssl: Prisma engines. su-exec: drop from root to 'node' in the entrypoint
# after taking ownership of a runtime-mounted persistent disk (e.g. Render).
RUN apk add --no-cache openssl su-exec

# Run as the non-root user shipped with the base image.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Pre-create the confined uploads root owned by the non-root runtime user; the
# app writes uploaded binaries here and cannot create it under root-owned /app.
# When a persistent disk is mounted here at runtime it is owned by root, so the
# entrypoint re-chowns it before dropping privileges (see docker-entrypoint.sh).
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

EXPOSE 3000

# The entrypoint starts as root only to chown a runtime-mounted disk, then
# re-execs itself as the non-root 'node' user. It applies pending migrations,
# optionally seeds baseline data, then boots the API.
ENTRYPOINT ["./docker-entrypoint.sh"]

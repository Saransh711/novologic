# workbook-api

GraphQL API for the **Online Workbook** product.

- **Framework:** NestJS (code-first GraphQL via the Apollo driver)
- **Database:** PostgreSQL accessed through Prisma
- **Language:** TypeScript (strict mode)
- **Local runtime:** Docker Compose (API + PostgreSQL)
- **Deploy target:** Render (Blueprint in `render.yaml`)

## Architecture

The codebase follows a layered, per-module structure:

```
src/
  config/                       # typed + validated environment schema
  infrastructure/prisma/        # PrismaService + global PrismaModule
  modules/
    health/
      domain/                   # business types (HealthReport)
      application/              # use cases / services (HealthService)
      interface/                # GraphQL resolvers + DTOs (HealthResolver, HealthStatus)
      health.module.ts
  app.module.ts                 # composition root
  main.ts                       # bootstrap (helmet, CORS, validation, throttling)
```

Resolvers stay thin and delegate to services; raw Prisma entities are never
exposed — services return domain types that resolvers map to GraphQL DTOs.

## Prerequisites

- Node.js >= 20
- Docker + Docker Compose (for local Postgres / full stack)

## Getting started (local, without Docker)

```bash
cp .env.example .env          # then adjust values as needed
npm install
docker compose up -d postgres # start only the database
npm run prisma:generate
npm run prisma:migrate        # create/apply migrations once you add models
npm run prisma:seed           # populate demo user/project/workbook (idempotent)
npm run start:dev
```

The GraphQL endpoint is served at `http://localhost:3000/graphql`.

## Getting started (full stack with Docker)

```bash
docker compose up --build
```

This single command brings the whole stack up end to end:

1. Starts PostgreSQL and waits until it is healthy.
2. Builds the API image.
3. On API startup the entrypoint **applies pending migrations**
   (`prisma migrate deploy`) and **seeds demo data** (idempotent), then boots
   the server.

Endpoints once it is up:

- GraphQL endpoint + in-browser playground (GraphiQL): `http://localhost:3000/graphql`
- Swagger UI (REST: health + uploads): `http://localhost:3000/docs`

Seeding runs automatically by default. To skip it (e.g. once the database is
populated) set `SEED_ON_STARTUP=false` for the `api` service. To reseed by hand:

```bash
docker compose exec api node dist/seed.js
```

### Verify the seeded data

The seed creates a demo user, a **Demo Project**, and an empty workbook. Query
them through the GraphQL endpoint:

```bash
# List seeded projects
curl -s http://localhost:3000/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ projects { id name createdAt } }"}'

# Fetch the workbook for a project (use an id from the previous response)
curl -s http://localhost:3000/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"query($id: ID!){ workbook(projectId: $id){ id projectId content } }","variables":{"id":"<PROJECT_ID>"}}'
```

## Health check

Query the API health (including a live database probe):

```graphql
query {
  health {
    status
    service
    timestamp
    uptimeSeconds
    database
  }
}
```

## Available scripts

| Script                    | Description                                  |
| ------------------------- | -------------------------------------------- |
| `npm run start:dev`       | Start in watch mode                          |
| `npm run build`           | Compile to `dist/`                           |
| `npm run start:prod`      | Run the compiled build                       |
| `npm run lint`            | ESLint (zero warnings allowed)               |
| `npm run format`          | Prettier write                               |
| `npm run prisma:generate` | Generate the Prisma client                   |
| `npm run prisma:migrate`  | Create + apply a dev migration               |
| `npm run prisma:deploy`   | Apply migrations (production)                |
| `npm run prisma:seed`     | Seed demo data (idempotent)                  |

## Environment variables

See [`.env.example`](./.env.example). The schema is validated at boot in
`src/config/env.validation.ts`; the app fails fast on invalid configuration.

## Deployment (Render)

[`render.yaml`](./render.yaml) is a Render Blueprint that provisions everything
needed to run the API in production:

- **Web service** (`workbook-api`) — built from the multi-stage [`Dockerfile`](./Dockerfile).
- **Managed PostgreSQL** (`workbook-db`) — `DATABASE_URL` is wired automatically
  into the web service via `fromDatabase`.
- **Persistent disk** — mounted at `/app/uploads` so uploaded binaries survive
  deploys/restarts.

### Production build & runtime

The Docker image is a three-stage build (deps → build → lean runtime):

1. Installs dependencies, runs `prisma generate`, and compiles to `dist/` with
   `nest build`.
2. Compiles the standalone seed script and prunes dev dependencies.
3. Ships a minimal runtime image that runs as the non-root `node` user.

`NODE_ENV=production` disables the GraphQL playground/introspection and applies
strict Helmet/CSP defaults.

### Migrations on deploy

On every deploy the container entrypoint
([`docker-entrypoint.sh`](./docker-entrypoint.sh)) runs **before** the server
boots:

1. `prisma migrate deploy` — applies any pending migrations (idempotent).
2. Optional demo seeding — **disabled in production** (`SEED_ON_STARTUP=false`).
3. Starts the API (`node dist/main.js`).

### Deploy steps (no auto-deploy required)

1. Push this repository to GitHub/GitLab.
2. In Render, create a new **Blueprint** and point it at this repo; Render reads
   `render.yaml` and provisions the database, disk, and web service.
3. Fill in the `sync: false` secrets in the dashboard before the first deploy
   finishes:
   - `CORS_ORIGINS` — your frontend origin(s), comma-separated.
   - `PUBLIC_BASE_URL` — the assigned service URL, e.g.
     `https://workbook-api.onrender.com` (no trailing slash).
4. Verify health at `https://<your-service>.onrender.com/health`.

> **Scaling note:** the persistent disk pins the web service to a single
> instance (no horizontal scaling or zero-downtime deploys). To scale out,
> move uploads to object storage (S3/R2) and remove the disk.

### Environment variables

Set automatically by the Blueprint / Render, or in the dashboard:

| Variable                  | Source                | Notes                                                        |
| ------------------------- | --------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`            | `fromDatabase`        | Injected from the managed PostgreSQL instance.               |
| `NODE_ENV`                | `render.yaml`         | `production`.                                                 |
| `PORT`                    | `render.yaml`         | `3000` (the app binds `0.0.0.0`).                            |
| `GRAPHQL_PLAYGROUND`      | `render.yaml`         | `false` in production.                                        |
| `CORS_ORIGINS`            | dashboard (`sync:false`) | Comma-separated frontend origin allowlist. **Required.**  |
| `PUBLIC_BASE_URL`         | dashboard (`sync:false`) | Deployed origin, no trailing slash. **Required.**         |
| `UPLOADS_DIR`             | `render.yaml`         | `/app/uploads` — must match the disk mount path.             |
| `RATE_LIMIT_TTL_MS` / `RATE_LIMIT_MAX` | `render.yaml` | Global rate limit window/budget.                       |
| `UPLOAD_RATE_LIMIT_TTL_MS` / `UPLOAD_RATE_LIMIT_MAX` | `render.yaml` | Stricter limit for the upload endpoint.   |
| `MAX_UPLOAD_SIZE_BYTES`   | `render.yaml`         | Max upload size (default 10 MiB).                            |
| `ALLOWED_MIME_TYPES`      | `render.yaml`         | Upload allowlist (images + PDF).                            |
| `SEED_ON_STARTUP`         | `render.yaml`         | `false` — never seed demo data into the production DB.       |

The full list with descriptions lives in [`.env.example`](./.env.example), and
the schema is validated at boot in `src/config/env.validation.ts` (the app fails
fast on invalid configuration).

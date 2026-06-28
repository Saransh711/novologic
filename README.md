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

`render.yaml` is a Render Blueprint that provisions a managed PostgreSQL
database and a Dockerized web service. `DATABASE_URL` is wired automatically
from the database; set `CORS_ORIGINS` to your frontend origin in the Render
dashboard.

# workbook-api

GraphQL API for the **Online Workbook** product. It stores projects, their
rich‑text workbooks (ProseMirror/Tiptap JSON), a bounded version history per
workbook, and binary file attachments (images + PDF).

- **Framework:** NestJS 11 — code‑first GraphQL via the Apollo driver
- **Database:** PostgreSQL accessed through Prisma 7 (`@prisma/adapter-pg`)
- **Language:** TypeScript (strict mode)
- **Local runtime:** Docker Compose (API + PostgreSQL)
- **Deploy target:** Render (Blueprint in [`render.yaml`](./render.yaml))

> **Frontend integration:** the frozen API contract for the frontend team —
> full GraphQL SDL, example requests/responses for every operation, the
> file‑upload endpoint spec, and error shapes — lives in
> [`docs/api-contract.md`](./docs/api-contract.md).

---

## Contents

- [Endpoints at a glance](#endpoints-at-a-glance)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment variables](#environment-variables)
- [Database setup](#database-setup)
- [Running locally via Docker](#running-locally-via-docker)
- [Running locally without Docker](#running-locally-without-docker)
- [Migrations & seed](#migrations--seed)
- [Available scripts](#available-scripts)
- [Deployment (Render)](#deployment-render)
- [Design decisions](#design-decisions)
- [Assumptions](#assumptions)

---

## Endpoints at a glance

| Surface | Method / path | Purpose |
| --- | --- | --- |
| GraphQL | `POST /graphql` | Primary API (queries + mutations). |
| GraphiQL | `GET /graphql` | In‑browser explorer (only when `GRAPHQL_PLAYGROUND=true`). |
| REST | `POST /files/upload` | Step 1 of the two‑step file upload (multipart binary). |
| REST | `GET /health` | Liveness/readiness probe with a live DB check. |
| Static | `GET /uploads/*` | Read‑only serving of uploaded binaries. |
| Swagger UI | `GET /docs` | OpenAPI docs for the REST surface (health + uploads). |

Local GraphQL URL: **`http://localhost:3000/graphql`**

---

## Architecture

The codebase follows a layered, per‑module (clean/hexagonal) structure. One
NestJS module per bounded context; modules talk only through public providers.

```
src/
  config/                         # typed + validated environment schema (env.validation.ts)
  common/                         # cross-cutting: filters, guards, validation, logging, swagger
  infrastructure/
    prisma/                       # PrismaService + global PrismaModule
    storage/                      # FileStorage abstraction + LocalFileStorage
  modules/
    health/                       # liveness/readiness (GraphQL + REST)
    project/                      # project listing
    workbook/                     # workbook save/read + version history
    file/                         # binary upload (REST) + metadata (GraphQL)
      domain/                     # business rules + constants
      application/                # use cases / services
      interface/                  # resolvers / controllers + DTOs
  app.module.ts                   # composition root
  main.ts                         # bootstrap: helmet, CORS, validation, static assets, swagger
```

Layering rules enforced throughout:

- **Resolvers/controllers stay thin** — validate input, delegate to a service,
  map the domain result to a GraphQL/REST DTO. No business logic, no Prisma
  calls at the boundary.
- **Raw entities are never exposed.** Services return domain/Prisma types that
  the interface layer maps to GraphQL object types.
- **Errors** are thrown as typed domain exceptions and translated to the right
  boundary representation by exception filters (see
  [Design decisions](#design-decisions)).

---

## Prerequisites

- **Node.js >= 20** (the Docker image uses Node 22).
- **Docker + Docker Compose** — for local PostgreSQL or the full stack.
- **npm** (ships with Node).

---

## Installation

```bash
git clone <repo-url>
cd workbook-api
cp .env.example .env     # then adjust values as needed
npm install
```

Installation follows the project dependency policy: install the **latest
stable** version of every package via the package manager (`npm install
pkg@latest`); versions are resolved at install time, never hand‑pinned.

---

## Environment variables

Configuration is read **only** through `@nestjs/config` and validated at boot by
`src/config/env.validation.ts`. The app **fails fast** with a descriptive error
if any variable is missing or malformed. The single required variable is
`DATABASE_URL`; everything else has a sensible default.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NODE_ENV` | no | `development` | `development` \| `production` \| `test`. |
| `PORT` | no | `3000` | Port the HTTP/GraphQL server binds (on `0.0.0.0`). |
| `DATABASE_URL` | **yes** | — | PostgreSQL connection string (Prisma datasource). |
| `CORS_ORIGINS` | no | `` (empty) | Comma‑separated allowlist of frontend origins. Empty = no cross‑origin requests allowed. |
| `GRAPHQL_PLAYGROUND` | no | `false` | Expose GraphiQL + introspection. Keep `false` in production. |
| `RATE_LIMIT_TTL_MS` | no | `60000` | Window (ms) for the global rate limiter. |
| `RATE_LIMIT_MAX` | no | `120` | Max requests per window for the global limiter. |
| `UPLOAD_RATE_LIMIT_TTL_MS` | no | `60000` | Window (ms) for the dedicated upload limiter. |
| `UPLOAD_RATE_LIMIT_MAX` | no | `20` | Max requests per window for the upload endpoint. |
| `UPLOADS_DIR` | no | `./uploads` | Confined root directory for stored binaries. |
| `MAX_UPLOAD_SIZE_BYTES` | no | `10485760` (10 MiB) | Maximum accepted upload size. |
| `ALLOWED_MIME_TYPES` | no | `image/png,image/jpeg,image/gif,image/webp,application/pdf` | Upload allowlist (images + PDF only). |
| `PUBLIC_BASE_URL` | no | `http://localhost:3000` | Base URL used to build absolute served file URLs (no trailing slash). |
| `UPLOADS_PUBLIC_PATH` | no | `/uploads` | URL path prefix under which binaries are served statically. |
| `SEED_ON_STARTUP` | no | `true` | **Consumed by the Docker entrypoint only** (not the app). When `true`, the container seeds demo data after migrating. Set `false` in production. |

The canonical, commented list is [`.env.example`](./.env.example). No secrets
are committed — provide real values via your environment or `.env` (gitignored).

---

## Database setup

The schema is defined in [`prisma/schema.prisma`](./prisma/schema.prisma) and
applied **exclusively** through Prisma migrations — never edit the database by
hand. Domain models:

| Model | Notes |
| --- | --- |
| `User` | Account owner. Unique `email`. Reached from a workbook only via its project. |
| `Project` | A workspace owned by one user. Aggregates one workbook and its files. Indexed on `userId`. |
| `Workbook` | The current editable ProseMirror document for a project. One per project (`projectId` unique). |
| `WorkbookVersion` | Immutable snapshot of a workbook's content, captured on each save/restore. Indexed on `workbookId`. |
| `File` | A binary asset for a project. `storageKey` is server‑generated and unique; client filenames are never used as keys. |

All foreign keys cascade on delete, and frequently filtered columns are indexed.

### Quick start (database only)

```bash
docker compose up -d postgres   # PostgreSQL 16 on localhost:5432
npm run prisma:generate         # generate the Prisma client
npm run prisma:migrate          # apply migrations to your local DB
npm run prisma:seed             # (optional) load demo data — idempotent
```

The default local connection string (matches `docker-compose.yml`):

```
postgresql://workbook:workbook@localhost:5432/workbook?schema=public
```

---

## Running locally via Docker

The whole stack (API + PostgreSQL) comes up end to end with one command:

```bash
docker compose up --build
```

What happens:

1. PostgreSQL starts and the API waits until it is **healthy**
   (`pg_isready` healthcheck).
2. The API image is built (multi‑stage: deps → build → lean runtime, runs as
   the non‑root `node` user).
3. On startup the entrypoint ([`docker-entrypoint.sh`](./docker-entrypoint.sh))
   **applies pending migrations** (`prisma migrate deploy`), then **seeds demo
   data** (idempotent) unless `SEED_ON_STARTUP=false`, then boots the server.

Once up:

- GraphQL endpoint + GraphiQL explorer: `http://localhost:3000/graphql`
- Swagger UI (REST: health + uploads): `http://localhost:3000/docs`
- Health probe: `http://localhost:3000/health`

> Uploaded binaries are persisted to the `uploads-data` Docker volume so they
> survive container restarts.

Reseed by hand at any time:

```bash
docker compose exec api node dist/seed.js
```

---

## Running locally without Docker

Use Docker only for PostgreSQL and run the API on the host with hot reload:

```bash
cp .env.example .env
npm install
docker compose up -d postgres
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run start:dev
```

GraphiQL is available at `http://localhost:3000/graphql` because
`GRAPHQL_PLAYGROUND=true` in `.env.example`.

---

## Migrations & seed

| Task | Command |
| --- | --- |
| Create + apply a new dev migration | `npm run prisma:migrate` |
| Apply existing migrations (CI/prod) | `npm run prisma:deploy` |
| Regenerate the Prisma client | `npm run prisma:generate` |
| Seed demo data (idempotent) | `npm run prisma:seed` |
| Inspect data visually | `npm run prisma:studio` |

**Seed contents** ([`prisma/seed.ts`](./prisma/seed.ts)): a demo `User`
(`demo@workbook.dev`), a **Demo Project**, and an empty workbook (a single empty
ProseMirror paragraph). The seed uses upserts, so it is safe to run repeatedly.

After seeding, list the seeded project and read its workbook:

```bash
curl -s http://localhost:3000/graphql -H 'Content-Type: application/json' \
  -d '{"query":"{ projects { id name createdAt } }"}'

curl -s http://localhost:3000/graphql -H 'Content-Type: application/json' \
  -d '{"query":"query($id: ID!){ workbook(projectId: $id){ id projectId content } }","variables":{"id":"<PROJECT_ID>"}}'
```

---

## Available scripts

| Script | Description |
| --- | --- |
| `npm run start:dev` | Start in watch mode (hot reload). |
| `npm run start` | Start without watch. |
| `npm run build` | Compile to `dist/`. |
| `npm run start:prod` | Run the compiled build. |
| `npm run lint` | ESLint (zero warnings allowed). |
| `npm run format` / `format:check` | Prettier write / check. |
| `npm run prisma:generate` | Generate the Prisma client. |
| `npm run prisma:migrate` | Create + apply a dev migration. |
| `npm run prisma:deploy` | Apply migrations (production). |
| `npm run prisma:seed` | Seed demo data (idempotent). |
| `npm run prisma:studio` | Open Prisma Studio. |

---

## Deployment (Render)

[`render.yaml`](./render.yaml) is a Render Blueprint that provisions:

- **Web service** (`workbook-api`) — built from the multi‑stage
  [`Dockerfile`](./Dockerfile).
- **Managed PostgreSQL** (`workbook-db`) — `DATABASE_URL` is wired in
  automatically via `fromDatabase`.
- **Persistent disk** — mounted at `/app/uploads` so uploaded binaries survive
  deploys/restarts.

On every deploy the entrypoint runs `prisma migrate deploy` before the server
boots; seeding is disabled in production (`SEED_ON_STARTUP=false`).
`NODE_ENV=production` disables the GraphQL playground/introspection and applies
strict Helmet/CSP defaults. Before the first deploy, set the dashboard secrets
`CORS_ORIGINS` (your frontend origin[s]) and `PUBLIC_BASE_URL` (the assigned
service URL, no trailing slash).

> **Scaling note:** the persistent disk pins the web service to a single
> instance. To scale horizontally, move uploads to object storage (S3/R2) and
> drop the disk.

---

## Design decisions

- **Code‑first GraphQL (Apollo driver).** Object types, inputs, and enums are
  declared as decorated TypeScript classes; the SDL is generated from them
  (`src/schema.gql` in dev, in memory in prod). This keeps types and schema in
  lockstep and avoids drift. See the frozen SDL in
  [`docs/api-contract.md`](./docs/api-contract.md).
- **Layered modules.** Each bounded context (`project`, `workbook`, `file`,
  `health`) splits into `domain` / `application` / `interface`, with
  infrastructure (Prisma, storage) injected. Resolvers never touch Prisma.
- **Two‑step file upload.** Binaries are uploaded over REST
  (`POST /files/upload`, multipart) because GraphQL is a poor fit for raw binary
  transfer. The endpoint validates type/size, stores the bytes under a
  **server‑generated** key (`YYYY/MM/<uuid>.<ext>`), and returns that key. The
  client then records metadata via the `uploadFileMetadata` GraphQL mutation.
  This cleanly separates byte transfer from the typed domain graph.
- **Workbook content as JSON.** Workbook content is a ProseMirror/Tiptap
  document stored as JSONB. The API performs a shallow structural check (must be
  an object with `type: "doc"`); deep schema validation is intentionally left to
  the editor, which owns the document schema.
- **Bounded version history.** Every `saveWorkbook`/`restoreWorkbookVersion`
  archives the previous content as a `WorkbookVersion` inside a single
  transaction, then prunes to the newest `MAX_WORKBOOK_VERSIONS` (5). Content and
  history can never diverge.
- **Typed domain errors → stable codes.** Services throw `ResourceNotFoundError`
  / `ResourceConflictError` / `InvalidInputError`. A `DomainErrorFilter` maps
  them to GraphQL errors with a stable `extensions.code` (`NOT_FOUND`,
  `CONFLICT`, `BAD_USER_INPUT`) or to JSON HTTP errors for REST. A catch‑all
  filter masks unexpected errors as `INTERNAL_SERVER_ERROR` and logs the real
  cause, so stack traces never leak. Codes are part of the public contract.
- **Security baseline.** Helmet headers + CSP; CORS restricted to an allowlist;
  uploads limited by a MIME allowlist and size cap; storage keys are
  server‑generated and every path is confined to the uploads root (path
  traversal is rejected); served binaries get `X-Content-Type-Options: nosniff`.
  All inputs are validated with `class-validator`, and the global
  `ValidationPipe` whitelists/forbids unknown fields.
- **Rate limiting.** A global throttler (`RATE_LIMIT_*`) protects the whole
  surface; a stricter, dedicated bucket (`UPLOAD_RATE_LIMIT_*`) guards
  `POST /files/upload`. Health probes are exempt so monitoring never trips the
  limit.
- **Structured logging.** All logs go through `nestjs-pino` (pretty in dev, JSON
  in prod). No `console.log`.

---

## Assumptions

- **No authentication/authorization yet.** There is no auth layer in this
  iteration. Operations are unauthenticated and the demo data models a single
  user. Adding auth (and per‑user scoping of `projects`) is the natural next
  step; the `User`/`Project` ownership model is already in place for it.
- **`User` is reached via `Project`.** Per the data model, a workbook/file is
  always accessed through its project; users are not exposed directly in the
  GraphQL graph.
- **Client supplies `projectId`.** Mutations that target a project trust the
  caller to pass a valid `projectId`; the server verifies existence and returns
  `NOT_FOUND` otherwise.
- **ProseMirror schema is owned by the editor.** The backend only guarantees the
  content is a `type: "doc"` object; it does not validate node/mark schemas.
- **Local disk storage for binaries.** Files are stored on a confined local
  directory / mounted disk, which pins the service to a single instance. Object
  storage (S3/R2) is the path to horizontal scaling.
- **Version history is capped at 5** snapshots per workbook; older versions are
  pruned automatically and are not recoverable.
- **CORS defaults to closed.** With `CORS_ORIGINS` empty, no cross‑origin
  browser requests are permitted — set it explicitly for your frontend.

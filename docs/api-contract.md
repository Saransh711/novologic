# Workbook API — Frozen Contract (v0.1.0)

This is the authoritative integration contract for the frontend team. It
describes every operation the **workbook-api** exposes, with example requests
and responses, the file‑upload endpoint, and error shapes.

- **Local GraphQL URL:** `http://localhost:3000/graphql`
- **GraphiQL explorer (dev only):** open `http://localhost:3000/graphql` in a
  browser when `GRAPHQL_PLAYGROUND=true`.
- **Transport:** `POST` with `Content-Type: application/json`. Body:
  `{ "query": "...", "variables": { ... } }`.
- **REST file upload:** `POST http://localhost:3000/files/upload`
  (`multipart/form-data`).
- **Static file serving:** `GET http://localhost:3000/uploads/<storageKey>`.
- **CSRF:** Apollo CSRF prevention is enabled. Browser clients sending
  `Content-Type: application/json` are unaffected. Tools sending
  `text/plain`/`multipart` to `/graphql` must include a non‑empty
  `Apollo-Require-Preflight: true` header. (The REST upload at `/files/upload`
  is unaffected.)

Scalars used below:

- `DateTime` — ISO‑8601 UTC string, e.g. `2026-06-28T09:41:42.245Z`.
- `JSON` — arbitrary JSON value; for workbook content this is a
  ProseMirror/Tiptap document (`{ "type": "doc", "content": [...] }`).
- `ID` / `String` / `Int` / `Float` / `Boolean` — standard GraphQL scalars.

---

## 1. GraphQL SDL (frozen schema)

This is the complete, generated schema. Types and fields are sorted
alphabetically.

```graphql
"""
A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format.
"""
scalar DateTime

"""Health of an individual downstream dependency."""
enum DependencyStatus {
  Down
  Up
}

"""A binary asset uploaded to a project."""
type File {
  """When the file metadata was recorded."""
  createdAt: DateTime!

  """Unique file identifier."""
  id: ID!

  """IANA media type of the file."""
  mimeType: String!

  """Human-readable display name of the file."""
  name: String!

  """Identifier of the owning project."""
  projectId: ID!

  """Size of the file in bytes."""
  size: Int!

  """Server-generated storage key locating the binary."""
  storageKey: String!
}

"""Liveness and readiness snapshot for the API."""
type HealthStatus {
  """PostgreSQL connectivity status."""
  database: DependencyStatus!

  """Name of the service reporting health."""
  service: String!

  """Aggregated service status."""
  status: ServiceStatus!

  """ISO-8601 timestamp when the report was generated."""
  timestamp: String!

  """Process uptime in seconds."""
  uptimeSeconds: Float!
}

"""
The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf).
"""
scalar JSON @specifiedBy(url: "http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf")

type Mutation {
  """
  Deletes a file record and its stored binary, returning the removed file.
  """
  deleteFile(id: ID!): File!

  """
  Restores a workbook to a previous version, archiving the current content as a new version first.
  """
  restoreWorkbookVersion(versionId: ID!): Workbook!

  """
  Creates or overwrites a project workbook, archiving the previous content as a version.
  """
  saveWorkbook(input: SaveWorkbookInput!): Workbook!

  """
  Records metadata for a file binary already stored under its storage key.
  """
  uploadFileMetadata(input: UploadFileMetadataInput!): File!
}

"""A workspace owned by a single user."""
type Project {
  """When the project was created."""
  createdAt: DateTime!

  """Unique project identifier."""
  id: ID!

  """Human-readable project name."""
  name: String!

  """Identifier of the user that owns the project."""
  userId: ID!
}

type Query {
  """Returns the current health of the API and its dependencies."""
  health: HealthStatus!

  """Lists projects, oldest first, with pagination."""
  projects(
    """Number of projects to skip before collecting the page."""
    skip: Int! = 0

    """Maximum number of projects to return (1-100)."""
    take: Int! = 20
  ): [Project!]!

  """Returns the workbook for a project, or null if none exists yet."""
  workbook(projectId: ID!): Workbook

  """Lists the most recent archived versions of a workbook, newest first."""
  workbookVersions(workbookId: ID!): [WorkbookVersion!]!
}

"""Input to create or overwrite a project workbook."""
input SaveWorkbookInput {
  """ProseMirror/Tiptap document to persist as the workbook content."""
  content: JSON!

  """Identifier of the project that owns the workbook."""
  projectId: String!
}

"""Overall health of the service."""
enum ServiceStatus {
  Degraded
  Ok
}

"""Metadata describing an already-uploaded file binary."""
input UploadFileMetadataInput {
  """IANA media type of the file (allowlist enforced server-side)."""
  mimeType: String!

  """Human-readable display name of the file."""
  name: String!

  """Identifier of the project the file belongs to."""
  projectId: String!

  """Size of the file in bytes."""
  size: Int!

  """Server-generated storage key locating the binary."""
  storageKey: String!
}

"""The current editable document for a project."""
type Workbook {
  """ProseMirror/Tiptap document content."""
  content: JSON!

  """When the workbook was first created."""
  createdAt: DateTime!

  """Unique workbook identifier."""
  id: ID!

  """Identifier of the owning project."""
  projectId: ID!

  """When the workbook content last changed."""
  updatedAt: DateTime!
}

"""An immutable snapshot of a workbook captured for version history."""
type WorkbookVersion {
  """Archived ProseMirror/Tiptap document content."""
  content: JSON!

  """When this version was archived."""
  createdAt: DateTime!

  """Unique version identifier."""
  id: ID!

  """Identifier of the workbook this version belongs to."""
  workbookId: ID!
}
```

### Input validation rules (enforced server‑side)

| Input field | Rules |
| --- | --- |
| `SaveWorkbookInput.projectId` | non‑empty string, max length 64. |
| `SaveWorkbookInput.content` | must be an object with `type: "doc"` (ProseMirror document). |
| `UploadFileMetadataInput.projectId` | non‑empty string, max length 64; project must exist. |
| `UploadFileMetadataInput.name` | non‑empty string, max length 255. |
| `UploadFileMetadataInput.mimeType` | non‑empty string, max length 255; must be in the server MIME allowlist. |
| `UploadFileMetadataInput.size` | integer ≥ 1; must not exceed `MAX_UPLOAD_SIZE_BYTES`. |
| `UploadFileMetadataInput.storageKey` | non‑empty string, max length 512; relative path of safe characters (`[A-Za-z0-9._/-]`), no leading slash, no `..` segments; the referenced binary must already exist. |
| `projects.take` | integer 1–100 (default 20). |
| `projects.skip` | integer ≥ 0 (default 0). |

> The global validation pipe also **rejects unknown fields** on inputs with a
> `BAD_REQUEST` error.

---

## 2. Queries

### 2.1 `health`

Liveness/readiness with a live database probe.

**Request**

```json
{
  "query": "query { health { status service timestamp uptimeSeconds database } }"
}
```

**Response** `200 OK`

```json
{
  "data": {
    "health": {
      "status": "Ok",
      "service": "workbook-api",
      "timestamp": "2026-06-28T11:15:42.724Z",
      "uptimeSeconds": 825,
      "database": "Up"
    }
  }
}
```

`status` is `Ok` | `Degraded`; `database` is `Up` | `Down`. When the DB probe
fails, `status` is `Degraded` and `database` is `Down` (the request still
returns `200`).

---

### 2.2 `projects`

Lists projects, oldest first, paginated.

**Request**

```json
{
  "query": "query ($take: Int!, $skip: Int!) { projects(take: $take, skip: $skip) { id userId name createdAt } }",
  "variables": { "take": 5, "skip": 0 }
}
```

**Response** `200 OK`

```json
{
  "data": {
    "projects": [
      {
        "id": "cmqxlnhet00014uxor1mz2zq6",
        "userId": "cmqxlnhej00004uxoi9830if2",
        "name": "Demo Project",
        "createdAt": "2026-06-28T09:41:42.245Z"
      }
    ]
  }
}
```

---

### 2.3 `workbook`

Returns the workbook for a project, or `null` if none exists yet.

**Request**

```json
{
  "query": "query ($id: ID!) { workbook(projectId: $id) { id projectId content createdAt updatedAt } }",
  "variables": { "id": "cmqxlnhet00014uxor1mz2zq6" }
}
```

**Response** `200 OK`

```json
{
  "data": {
    "workbook": {
      "id": "cmqxlnhex00024uxoygcm2q2g",
      "projectId": "cmqxlnhet00014uxor1mz2zq6",
      "content": { "type": "doc", "content": [{ "type": "paragraph" }] },
      "createdAt": "2026-06-28T09:41:42.249Z",
      "updatedAt": "2026-06-28T09:41:42.249Z"
    }
  }
}
```

When the project has no workbook, `data.workbook` is `null` (this is not an
error).

---

### 2.4 `workbookVersions`

Lists the most recent archived versions of a workbook, newest first (capped at
5). Errors with `NOT_FOUND` if the workbook does not exist.

**Request**

```json
{
  "query": "query ($id: ID!) { workbookVersions(workbookId: $id) { id workbookId content createdAt } }",
  "variables": { "id": "cmqxlnhex00024uxoygcm2q2g" }
}
```

**Response** `200 OK`

```json
{
  "data": {
    "workbookVersions": [
      {
        "id": "cmqyver200001abcd1234efgh",
        "workbookId": "cmqxlnhex00024uxoygcm2q2g",
        "content": { "type": "doc", "content": [{ "type": "paragraph" }] },
        "createdAt": "2026-06-28T10:05:11.120Z"
      }
    ]
  }
}
```

If the workbook has never been overwritten, the list is empty (`[]`).

---

## 3. Mutations

### 3.1 `saveWorkbook`

Creates the project's workbook or overwrites its content. When overwriting, the
previous content is archived as a `WorkbookVersion` (history pruned to the newest
5). Errors with `NOT_FOUND` if the project does not exist, or `BAD_REQUEST` if
`content` is not a valid ProseMirror `doc`.

**Request**

```json
{
  "query": "mutation ($input: SaveWorkbookInput!) { saveWorkbook(input: $input) { id projectId content createdAt updatedAt } }",
  "variables": {
    "input": {
      "projectId": "cmqxlnhet00014uxor1mz2zq6",
      "content": {
        "type": "doc",
        "content": [
          { "type": "paragraph", "content": [{ "type": "text", "text": "Hello workbook" }] }
        ]
      }
    }
  }
}
```

**Response** `200 OK`

```json
{
  "data": {
    "saveWorkbook": {
      "id": "cmqxlnhex00024uxoygcm2q2g",
      "projectId": "cmqxlnhet00014uxor1mz2zq6",
      "content": {
        "type": "doc",
        "content": [
          { "type": "paragraph", "content": [{ "type": "text", "text": "Hello workbook" }] }
        ]
      },
      "createdAt": "2026-06-28T09:41:42.249Z",
      "updatedAt": "2026-06-28T11:20:03.481Z"
    }
  }
}
```

---

### 3.2 `restoreWorkbookVersion`

Restores a workbook to a previous version. The current content is first archived
as a new snapshot (history pruned to the newest 5), then the workbook is
overwritten with the selected version's content. Errors with `NOT_FOUND` if the
version (or its workbook) does not exist.

**Request**

```json
{
  "query": "mutation ($versionId: ID!) { restoreWorkbookVersion(versionId: $versionId) { id projectId content updatedAt } }",
  "variables": { "versionId": "cmqyver200001abcd1234efgh" }
}
```

**Response** `200 OK`

```json
{
  "data": {
    "restoreWorkbookVersion": {
      "id": "cmqxlnhex00024uxoygcm2q2g",
      "projectId": "cmqxlnhet00014uxor1mz2zq6",
      "content": { "type": "doc", "content": [{ "type": "paragraph" }] },
      "updatedAt": "2026-06-28T11:22:47.903Z"
    }
  }
}
```

---

### 3.3 `uploadFileMetadata`

Step 2 of the file flow: records metadata for a binary already uploaded via
`POST /files/upload`. Requires the `storageKey` returned by that endpoint.
Validates the project exists, the binary exists, and the MIME/size are allowed.
Errors: `NOT_FOUND` (project missing), `BAD_USER_INPUT` (no binary for the key,
unsupported type, or over size), `CONFLICT` (a file with that `storageKey`
already exists).

**Request**

```json
{
  "query": "mutation ($input: UploadFileMetadataInput!) { uploadFileMetadata(input: $input) { id projectId name mimeType size storageKey createdAt } }",
  "variables": {
    "input": {
      "projectId": "cmqxlnhet00014uxor1mz2zq6",
      "name": "diagram.png",
      "mimeType": "image/png",
      "size": 20480,
      "storageKey": "2026/06/3f1c9a2b-1c2d-4e5f-9a8b-7c6d5e4f3a2b.png"
    }
  }
}
```

**Response** `200 OK`

```json
{
  "data": {
    "uploadFileMetadata": {
      "id": "cmqyfile0001wxyz5678ijkl",
      "projectId": "cmqxlnhet00014uxor1mz2zq6",
      "name": "diagram.png",
      "mimeType": "image/png",
      "size": 20480,
      "storageKey": "2026/06/3f1c9a2b-1c2d-4e5f-9a8b-7c6d5e4f3a2b.png",
      "createdAt": "2026-06-28T11:25:09.004Z"
    }
  }
}
```

---

### 3.4 `deleteFile`

Deletes a file's metadata record and its stored binary, returning the removed
file. Errors with `NOT_FOUND` if no file has that id.

**Request**

```json
{
  "query": "mutation ($id: ID!) { deleteFile(id: $id) { id projectId name storageKey } }",
  "variables": { "id": "cmqyfile0001wxyz5678ijkl" }
}
```

**Response** `200 OK`

```json
{
  "data": {
    "deleteFile": {
      "id": "cmqyfile0001wxyz5678ijkl",
      "projectId": "cmqxlnhet00014uxor1mz2zq6",
      "name": "diagram.png",
      "storageKey": "2026/06/3f1c9a2b-1c2d-4e5f-9a8b-7c6d5e4f3a2b.png"
    }
  }
}
```

---

## 4. File upload endpoint (REST)

Binary transfer is done over REST, not GraphQL. This is **step 1** of the
two‑step flow; pass the returned `storageKey` to the `uploadFileMetadata`
mutation (step 2).

### Endpoint

| | |
| --- | --- |
| **Method / path** | `POST /files/upload` |
| **Local URL** | `http://localhost:3000/files/upload` |
| **Content‑Type (request)** | `multipart/form-data` |
| **Form field** | exactly one file in the field named `file` |
| **Success status** | `201 Created` |
| **Allowed MIME types** | `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `application/pdf` (configurable via `ALLOWED_MIME_TYPES`) |
| **Max size** | 10 MiB / `10485760` bytes (configurable via `MAX_UPLOAD_SIZE_BYTES`) |
| **Rate limit** | dedicated bucket: 20 requests / 60 s (configurable) |

The server **generates** the storage key (`YYYY/MM/<uuid>.<ext>`); client
filenames are never used to build storage paths. The original filename is
sanitized and returned as `name` for display only.

### Request (curl)

```bash
curl -X POST http://localhost:3000/files/upload \
  -F "file=@./diagram.png"
```

### Success response — `201 Created`

```json
{
  "storageKey": "2026/06/3f1c9a2b-1c2d-4e5f-9a8b-7c6d5e4f3a2b.png",
  "url": "http://localhost:3000/uploads/2026/06/3f1c9a2b-1c2d-4e5f-9a8b-7c6d5e4f3a2b.png",
  "name": "diagram.png",
  "mimeType": "image/png",
  "size": 20480
}
```

| Field | Type | Description |
| --- | --- | --- |
| `storageKey` | string | Server‑generated key. **Submit this to `uploadFileMetadata`.** |
| `url` | string | Absolute URL the stored binary is served from (built from `PUBLIC_BASE_URL`). |
| `name` | string | Sanitized original filename (display only). |
| `mimeType` | string | Detected MIME type of the stored file. |
| `size` | number | Stored size in bytes. |

### Serving uploaded files

Stored binaries are served read‑only at `GET /uploads/<storageKey>` (the `url`
above) with `X-Content-Type-Options: nosniff` and
`Cross-Origin-Resource-Policy: cross-origin`.

### Error responses (REST)

The REST boundary returns a consistent JSON error body (see
[§5.2](#52-rest-error-shape)).

| Scenario | Status | `code` | Example `message` |
| --- | --- | --- | --- |
| `file` field missing | `400` | `BAD_USER_INPUT` | `A multipart file field named "file" is required.` |
| Unsupported MIME type | `400` | `BAD_USER_INPUT` | `Unsupported file type "image/svg+xml".` |
| Over size limit (service check) | `400` | `BAD_USER_INPUT` | `File size 12000000 bytes exceeds the limit of 10485760 bytes.` |
| Over size limit (multipart parser) | `413` | `LIMIT_FILE_SIZE` | `Uploaded file exceeds the maximum allowed size.` |
| Too many requests | `429` | — | rate limit exceeded. |

Example (`400`, missing file):

```json
{
  "statusCode": 400,
  "code": "BAD_USER_INPUT",
  "message": "A multipart file field named \"file\" is required."
}
```

---

## 5. Error shapes

### 5.1 GraphQL error shape

Errors are returned in the standard GraphQL `errors` array. The server strips
stack traces and internal detail; only `message`, `locations`, `path`, and
`extensions.code` are exposed. A response may include both `data` and `errors`
(partial results). `extensions.code` is a **stable, machine‑readable** value —
branch on it, not on `message`.

**HTTP status:** resolver/execution errors (e.g. `NOT_FOUND`, `BAD_REQUEST`)
are returned with HTTP `200` and the failure inside the `errors` array. Only
errors raised *before* execution — i.e. schema validation
(`GRAPHQL_VALIDATION_FAILED`) — return HTTP `400`. Always inspect the `errors`
array regardless of HTTP status.

```json
{
  "errors": [
    {
      "message": "Workbook \"does-not-exist\" was not found.",
      "locations": [{ "line": 1, "column": 3 }],
      "path": ["workbookVersions"],
      "extensions": { "code": "NOT_FOUND" }
    }
  ],
  "data": null
}
```

**Domain error codes** (from the application layer):

| `extensions.code` | Meaning | Raised when |
| --- | --- | --- |
| `NOT_FOUND` | Referenced resource does not exist. | Project/workbook/version/file lookups miss. |
| `BAD_USER_INPUT` | Input rejected by a domain rule. | Unsupported MIME type, file over size, missing stored binary. |
| `CONFLICT` | Uniqueness/state conflict. | A file with the given `storageKey` already exists. |

**Framework/transport error codes** (from GraphQL/NestJS, not domain logic):

| `extensions.code` | Meaning |
| --- | --- |
| `GRAPHQL_VALIDATION_FAILED` | Query is invalid against the schema (unknown field, wrong type, etc.). |
| `BAD_REQUEST` | Input failed `class-validator` rules in the validation pipe (e.g. `content` is not a ProseMirror `doc`, unknown input field, value out of range). Message is `Bad Request Exception`. |
| `INTERNAL_SERVER_ERROR` | Unexpected/unhandled error. Message is masked to `An unexpected error occurred.` |

Examples:

Schema validation failure (note: no `data` key is present):

```json
{
  "errors": [
    {
      "message": "Cannot query field \"nope\" on type \"Query\".",
      "locations": [{ "line": 1, "column": 3 }],
      "extensions": { "code": "GRAPHQL_VALIDATION_FAILED" }
    }
  ]
}
```

Input validation failure (e.g. `content` not a `doc`):

```json
{
  "errors": [
    {
      "message": "Bad Request Exception",
      "locations": [{ "line": 1, "column": 38 }],
      "path": ["saveWorkbook"],
      "extensions": { "code": "BAD_REQUEST" }
    }
  ],
  "data": null
}
```

### 5.2 REST error shape

REST endpoints (`/files/upload`, `/health`) return a flat JSON body:

```json
{
  "statusCode": 400,
  "code": "BAD_USER_INPUT",
  "message": "Unsupported file type \"image/svg+xml\"."
}
```

| Field | Type | Description |
| --- | --- | --- |
| `statusCode` | number | HTTP status code. |
| `code` | string | Stable machine‑readable code (domain codes above, or a multipart code like `LIMIT_FILE_SIZE`). |
| `message` | string | Human‑readable explanation (masked for `5xx`). |

Domain‑error → HTTP status mapping for REST: `NOT_FOUND` → `404`, `CONFLICT` →
`409`, `BAD_USER_INPUT` → `400`.

---

## 6. Typical frontend flow

1. **List projects** — `projects` query (or use the seeded **Demo Project** in
   local dev).
2. **Load the editor** — `workbook(projectId)`; render `content`. If `null`,
   start from an empty `doc`.
3. **Save edits** — `saveWorkbook(input)`; the previous content is auto‑archived.
4. **Version history** — `workbookVersions(workbookId)`; restore with
   `restoreWorkbookVersion(versionId)`.
5. **Attachments** —
   1. `POST /files/upload` (multipart) → returns `storageKey` + `url`.
   2. `uploadFileMetadata(input)` with that `storageKey` to record it against the
      project.
   3. Render via the returned `url`; remove with `deleteFile(id)`.

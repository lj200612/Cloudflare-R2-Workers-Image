# Cloudflare R2 Workers Image Hosting

[简体中文](README.md) | [English](README.en.md)

A lightweight image hosting API built on Cloudflare Workers + R2.

## Features

- Upload images (`multipart/form-data` or raw body)
- Auto-detect image type by magic bytes (JPEG/PNG/GIF/WebP)
- Content-based deduplication (same file, same ID)
- Public image serving with cache headers
- Optional Cloudflare Image Resizing passthrough
- Image metadata query and paginated listing
- Single delete (admin token or per-image delete token)
- Bulk delete (admin token)
- Basic anti-hotlink, CORS, and per-IP rate limiting

## Tech Stack

- Cloudflare Workers
- Cloudflare R2 (image objects + metadata)
- Cloudflare Durable Objects (rate limit coordinator)
- TypeScript
- Wrangler 4

## Setup and Deployment

### 1) Prerequisites

- Node.js 20+
- npm 10+
- Cloudflare account

### 2) Install dependencies

```bash
npm ci
```

### 3) Login to Cloudflare

```bash
npx wrangler login
```

### 4) Create Cloudflare resources

Create R2 bucket:

```bash
npx wrangler r2 bucket create image-hosting
```

Durable Object binding and migration are already defined in `wrangler.toml`.

### 5) Configure environment variables

Local development (`.dev.vars`):

```bash
API_TOKEN=dev-test-token-change-me
```

Production secret:

```bash
npx wrangler secret put API_TOKEN
```

### 6) Verify `wrangler.toml`

- `main = "src/index.ts"`
- `[[r2_buckets]]` binding is `IMAGE_BUCKET`
- `[[durable_objects.bindings]]` includes `RATE_LIMITER`
- `[[migrations]]` includes `RateLimitDurableObject`

### 7) Run locally

```bash
npm run dev
```

Health check:

```bash
curl http://127.0.0.1:8787/health
```

### 8) Type check

```bash
npm run typecheck
```

### 9) Run unit tests

```bash
npm run test
```

Coverage with thresholds:

```bash
npm run test:coverage
```

### 10) Deploy

```bash
npm run deploy
```

## API

Base URL examples:

- Local: `http://127.0.0.1:8787`
- Prod: your worker domain, or `BASE_URL` if configured

### Health Check

- `GET /health`

```bash
curl http://127.0.0.1:8787/health
```

### Upload Image

- `POST /images`
- Auth required: `Authorization: Bearer <API_TOKEN>`
- Supports `multipart/form-data` (field name `file`) and raw request body

```bash
curl -X POST "http://127.0.0.1:8787/images" \
  -H "Authorization: Bearer dev-test-token-change-me" \
  -F "file=@./demo.png"
```

Response includes:

- `id` (example: `a1b2c3...24hex.png`)
- `url`
- `deleteToken`
- `size`
- `type`

### Serve Image

- `GET /images/:id`

```bash
curl -L "http://127.0.0.1:8787/images/<id>" --output out.png
```

Optional transform query params (when `ENABLE_IMAGE_RESIZING=true`):

- `preset` (`thumb|small|medium|large`)
- `w` (max 2000)
- `h` (max 2000)
- `f` (`webp|jpeg|png`)
- `fit` (`contain|cover|crop|scale-down`)

Example:

```bash
curl -L "http://127.0.0.1:8787/images/<id>?preset=thumb" --output thumb.webp
```

### List Images

- `GET /images`
- Auth required
- Query param `limit` (1-100, default 50)
- Query param `cursor` (for next page)

```bash
curl "http://127.0.0.1:8787/images?limit=20" \
  -H "Authorization: Bearer dev-test-token-change-me"
```

### Image Info

- `GET /images/:id/info`
- Auth required

```bash
curl "http://127.0.0.1:8787/images/<id>/info" \
  -H "Authorization: Bearer dev-test-token-change-me"
```

### Delete One Image

- `DELETE /images/:id`
- Auth mode A: admin token (`Authorization: Bearer <API_TOKEN>`)
- Auth mode B: per-image delete token (`X-Delete-Token: <token>`)

```bash
curl -X DELETE "http://127.0.0.1:8787/images/<id>" \
  -H "Authorization: Bearer dev-test-token-change-me"
```

```bash
curl -X DELETE "http://127.0.0.1:8787/images/<id>" \
  -H "X-Delete-Token: <deleteToken>"
```

### Bulk Delete

- `POST /images/bulk-delete`
- Auth required
- Body: `{ "ids": ["id1", "id2"] }`
- Max 100 IDs per request

```bash
curl -X POST "http://127.0.0.1:8787/images/bulk-delete" \
  -H "Authorization: Bearer dev-test-token-change-me" \
  -H "Content-Type: application/json" \
  -d "{\"ids\":[\"<id1>\",\"<id2>\"]}"
```

## Configuration

Configured in `wrangler.toml` (`[vars]`) unless noted:

- `API_TOKEN` (secret, recommended via `wrangler secret put API_TOKEN`)
- `ALLOWED_REFERERS` (comma-separated domains, supports `*.example.com`)
- `ALLOW_EMPTY_REFERER` (`true|false`)
- `MAX_FILE_SIZE` (bytes, default `5242880`)
- `ALLOWED_ORIGINS` (`*` or comma-separated origins)
- `BASE_URL` (optional public base URL)
- `ENABLE_IMAGE_RESIZING` (`true|false`)
- `RATE_LIMIT_UPLOADS_PER_MINUTE` (default `10`)
- `RATE_LIMIT_REQUESTS_PER_MINUTE` (default `60`)

## Project Structure

```txt
src/
  index.ts               # Router + middleware composition
  handlers/              # Route handlers
  middleware/            # Auth/CORS/referer/rate limit checks
  services/              # R2 + image signature logic
  utils/                 # Hashing/validation/response helpers
  config.ts              # Constants and presets
  types.ts               # Env and API types
```

## Notes

- Metadata is stored in R2 `customMetadata`.
- Rate limiting uses Durable Objects in a 60-second fixed window.
- GitHub Actions runs `typecheck` and `test:coverage` on push/PR via `.github/workflows/tests.yml`.

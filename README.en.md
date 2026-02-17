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

## One-Click Deploy on Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/lj200612/Cloudflare-R2-Workers-Image)

After clicking the button, only fill the required variable:

- `API_TOKEN` (required, used for admin API auth)

Example:

```env
API_TOKEN=replace-with-a-strong-token
```

## wrangler.toml Reference

Current `wrangler.toml` in this project:

```toml
name = "image-hosting"
main = "src/index.ts"
compatibility_date = "2024-12-01"

[vars]
ALLOWED_REFERERS = ""
ALLOW_EMPTY_REFERER = "true"
MAX_FILE_SIZE = "5242880"
ALLOWED_ORIGINS = "*"
BASE_URL = ""
ENABLE_IMAGE_RESIZING = "false"
RATE_LIMIT_UPLOADS_PER_MINUTE = "10"
RATE_LIMIT_REQUESTS_PER_MINUTE = "60"

[[r2_buckets]]
binding = "IMAGE_BUCKET"
bucket_name = "image-hosting"

[[durable_objects.bindings]]
name = "RATE_LIMITER"
class_name = "RateLimitDurableObject"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["RateLimitDurableObject"]
```

### Top-level fields

| Field | Current value | Required | Description | Recommendation |
| --- | --- | --- | --- | --- |
| `name` | `image-hosting` | Yes | Worker service name in Cloudflare. | Use environment-specific names for multi-env setups. |
| `main` | `src/index.ts` | Yes (optional for assets-only Workers) | Worker entry file. | Usually unchanged unless project layout changes. |
| `compatibility_date` | `2024-12-01` | Yes | Controls runtime compatibility behavior. | Move forward only after regression testing. |

### `[vars]` detailed reference

Note: `[vars]` supports text and JSON values; this project currently uses string values and parses booleans/numbers in application code.

| Variable | Default | Required | Detailed behavior | Common tuning |
| --- | --- | --- | --- | --- |
| `ALLOWED_REFERERS` | `""` | No | Hotlink allowlist, comma-separated, supports `*.example.com`. Empty means no referer restriction. | Set explicit domains in production. |
| `ALLOW_EMPTY_REFERER` | `"true"` | No | Whether requests with empty referer are allowed. | Set `"false"` for stricter anti-hotlink policy. |
| `MAX_FILE_SIZE` | `"5242880"` | No | Maximum upload size in bytes (default 5MB). | Increase/decrease based on business limits. |
| `ALLOWED_ORIGINS` | `"*"` | No | CORS allowlist. `*` allows all origins. | Use explicit origins in production. |
| `BASE_URL` | `""` | No | Base URL used in returned image links. Empty falls back to request host. | Set when using a custom domain. |
| `ENABLE_IMAGE_RESIZING` | `"false"` | No | Enables transformation query params (`w/h/f/fit/preset`). | Set `"true"` only when needed. |
| `RATE_LIMIT_UPLOADS_PER_MINUTE` | `"10"` | No | Upload rate limit per IP per minute. | Adjust with traffic and abuse patterns. |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | `"60"` | No | Image request rate limit per IP per minute. | Increase for high-traffic read workloads. |

### Resource bindings and migration fields

| Field | Current value | Required | Detailed behavior |
| --- | --- | --- | --- |
| `[[r2_buckets]].binding` | `IMAGE_BUCKET` | Yes | Worker-side variable name for R2 access, used as `env.IMAGE_BUCKET`. |
| `[[r2_buckets]].bucket_name` | `image-hosting` | Yes | Actual R2 bucket name in your Cloudflare account. |
| `[[durable_objects.bindings]].name` | `RATE_LIMITER` | Yes | Worker-side variable name for DO namespace, used as `env.RATE_LIMITER`. |
| `[[durable_objects.bindings]].class_name` | `RateLimitDurableObject` | Yes | Durable Object class name; must match exported class. |
| `[[migrations]].tag` | `v1` | Yes | Migration version label. Increment on schema/class changes (e.g. `v2`). |
| `[[migrations]].new_sqlite_classes` | `["RateLimitDurableObject"]` | Depends on migration | Declares SQLite-backed DO classes created in this migration step. |

Optional `r2_buckets` fields (not enabled in current config):

- `jurisdiction`: Sets bucket jurisdiction (when using jurisdiction constraints).
- `preview_bucket_name`: Bucket name used in `wrangler dev` preview.

New R2 bucket options (set when creating the bucket):

| Option | CLI flag | Allowed values | Notes |
| --- | --- | --- | --- |
| `Location` | `--location` | `apac` / `eeur` / `enam` / `weur` / `wnam` / `oc` | Location hint. If omitted, Cloudflare auto-selects (Automatic, recommended). |
| `Default Storage Class` | `--storage-class` | `Standard` / `Infrequent Access` (common CLI values: `Standard` / `InfrequentAccess`) | Bucket default storage class. `Infrequent Access` has 30-day minimum storage duration and retrieval processing fees. |

Location value mapping:

- `apac`: Asia-Pacific
- `eeur`: Eastern Europe
- `enam`: Eastern North America
- `weur`: Western Europe
- `wnam`: Western North America
- `oc`: Oceania

Example (set both when creating a bucket):

```bash
npx wrangler r2 bucket create image-hosting --location wnam --storage-class Standard
```

Notes:

- These are bucket-creation/properties settings, not Worker binding fields.
- In `wrangler.toml`, `[[r2_buckets]]` only needs `bucket_name` for binding.

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

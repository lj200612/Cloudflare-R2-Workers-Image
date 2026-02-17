# Cloudflare R2 Workers 图片托管

[简体中文](README.md) | [English](README.en.md)

一个基于 Cloudflare Workers + R2 的轻量图片托管 API。

## 功能

- 上传图片（`multipart/form-data` 或原始请求体）
- 基于 magic bytes 自动识别图片类型（JPEG/PNG/GIF/WebP）
- 基于内容哈希去重（同文件同 ID）
- 带缓存头的公开图片访问
- 可选 Cloudflare Image Resizing 透传
- 图片元信息查询与分页列表
- 单张删除（管理员 token 或单图删除 token）
- 批量删除（管理员 token）
- 基础防盗链、CORS、按 IP 限流

## 技术栈

- Cloudflare Workers
- Cloudflare R2（图片对象与元数据）
- Cloudflare Durable Objects（限流协调）
- TypeScript
- Wrangler 4

## 搭建与部署

### 1) 前置条件

- Node.js 20+
- npm 10+
- Cloudflare 账号

### 2) 安装依赖

```bash
npm ci
```

### 3) 登录 Cloudflare

```bash
npx wrangler login
```

### 4) 创建 Cloudflare 资源

创建 R2 存储桶：

```bash
npx wrangler r2 bucket create image-hosting
```

Durable Object 的 binding 和 migration 已在 `wrangler.toml` 中定义。

### 5) 配置环境变量

本地开发（`.dev.vars`）：

```bash
API_TOKEN=dev-test-token-change-me
```

生产环境 secret：

```bash
npx wrangler secret put API_TOKEN
```

### 6) 检查 `wrangler.toml`

- `main = "src/index.ts"`
- `[[r2_buckets]]` 的 binding 是 `IMAGE_BUCKET`
- `[[durable_objects.bindings]]` 包含 `RATE_LIMITER`
- `[[migrations]]` 包含 `RateLimitDurableObject`

### 7) 本地运行

```bash
npm run dev
```

健康检查：

```bash
curl http://127.0.0.1:8787/health
```

### 8) 类型检查

```bash
npm run typecheck
```

### 9) 运行单元测试

```bash
npm run test
```

带覆盖率门槛：

```bash
npm run test:coverage
```

### 10) 部署

```bash
npm run deploy
```

## API

Base URL 示例：

- 本地：`http://127.0.0.1:8787`
- 生产：你的 Worker 域名，或配置的 `BASE_URL`

### 健康检查

- `GET /health`

```bash
curl http://127.0.0.1:8787/health
```

### 上传图片

- `POST /images`
- 需要鉴权：`Authorization: Bearer <API_TOKEN>`
- 支持 `multipart/form-data`（字段名 `file`）和原始请求体

```bash
curl -X POST "http://127.0.0.1:8787/images" \
  -H "Authorization: Bearer dev-test-token-change-me" \
  -F "file=@./demo.png"
```

响应包含：

- `id`（示例：`a1b2c3...24hex.png`）
- `url`
- `deleteToken`
- `size`
- `type`

### 访问图片

- `GET /images/:id`

```bash
curl -L "http://127.0.0.1:8787/images/<id>" --output out.png
```

可选变换参数（当 `ENABLE_IMAGE_RESIZING=true` 时生效）：

- `preset`（`thumb|small|medium|large`）
- `w`（最大 2000）
- `h`（最大 2000）
- `f`（`webp|jpeg|png`）
- `fit`（`contain|cover|crop|scale-down`）

示例：

```bash
curl -L "http://127.0.0.1:8787/images/<id>?preset=thumb" --output thumb.webp
```

### 列出图片

- `GET /images`
- 需要鉴权
- 查询参数 `limit`（1-100，默认 50）
- 查询参数 `cursor`（下一页游标）

```bash
curl "http://127.0.0.1:8787/images?limit=20" \
  -H "Authorization: Bearer dev-test-token-change-me"
```

### 图片信息

- `GET /images/:id/info`
- 需要鉴权

```bash
curl "http://127.0.0.1:8787/images/<id>/info" \
  -H "Authorization: Bearer dev-test-token-change-me"
```

### 删除单张图片

- `DELETE /images/:id`
- 鉴权方式 A：管理员 token（`Authorization: Bearer <API_TOKEN>`）
- 鉴权方式 B：单图删除 token（`X-Delete-Token: <token>`）

```bash
curl -X DELETE "http://127.0.0.1:8787/images/<id>" \
  -H "Authorization: Bearer dev-test-token-change-me"
```

```bash
curl -X DELETE "http://127.0.0.1:8787/images/<id>" \
  -H "X-Delete-Token: <deleteToken>"
```

### 批量删除

- `POST /images/bulk-delete`
- 需要鉴权
- 请求体：`{ "ids": ["id1", "id2"] }`
- 单次最多 100 个 ID

```bash
curl -X POST "http://127.0.0.1:8787/images/bulk-delete" \
  -H "Authorization: Bearer dev-test-token-change-me" \
  -H "Content-Type: application/json" \
  -d "{\"ids\":[\"<id1>\",\"<id2>\"]}"
```

## 配置项

默认在 `wrangler.toml` 的 `[vars]` 中配置（除特别说明）：

- `API_TOKEN`（敏感信息，建议用 `wrangler secret put API_TOKEN`）
- `ALLOWED_REFERERS`（逗号分隔域名，支持 `*.example.com`）
- `ALLOW_EMPTY_REFERER`（`true|false`）
- `MAX_FILE_SIZE`（字节，默认 `5242880`）
- `ALLOWED_ORIGINS`（`*` 或逗号分隔 origins）
- `BASE_URL`（可选，公网基础地址）
- `ENABLE_IMAGE_RESIZING`（`true|false`）
- `RATE_LIMIT_UPLOADS_PER_MINUTE`（默认 `10`）
- `RATE_LIMIT_REQUESTS_PER_MINUTE`（默认 `60`）

## 项目结构

```txt
src/
  index.ts               # 路由与中间件编排
  handlers/              # 各路由处理器
  middleware/            # 鉴权/CORS/防盗链/限流
  services/              # R2 与图片签名检测
  utils/                 # 哈希/校验/响应工具
  config.ts              # 常量与预设
  types.ts               # Env 与 API 类型
```

## 说明

- 元数据存储在 R2 `customMetadata` 中。
- 限流使用 Durable Objects 的 60 秒固定窗口计数。
- GitHub Actions 会在 push/PR 自动运行 `typecheck` 与 `test:coverage`，配置见 `.github/workflows/tests.yml`。

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

## Cloudflare 一键部署

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/lj200612/Cloudflare-R2-Workers-Image)

点击按钮后，仅需填写必要变量：

- `API_TOKEN`（必填，用于管理接口鉴权）

示例：

```env
API_TOKEN=replace-with-a-strong-token
```

## wrangler.toml 详解

当前项目使用的 `wrangler.toml`：

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

### 顶层字段说明

| 字段 | 当前值 | 必填 | 说明 | 调整建议 |
| --- | --- | --- | --- | --- |
| `name` | `image-hosting` | 是 | Worker 服务名（部署后在 Cloudflare 中显示的项目名）。 | 多环境建议区分命名，例如 `image-hosting-prod`。 |
| `main` | `src/index.ts` | 是（仅静态资源 Worker 可省略） | Worker 入口文件。 | 除非你调整目录结构，一般不改。 |
| `compatibility_date` | `2024-12-01` | 是 | 控制 Workers 运行时的兼容行为。 | 升级前先在测试环境回归，再前移日期。 |

### `[vars]` 字段说明

说明：`[vars]` 支持文本和 JSON 值；本项目当前全部使用字符串值，再在代码里解析（如布尔值/数字）。

| 变量 | 默认值 | 必填 | 详细说明 | 常见调整 |
| --- | --- | --- | --- | --- |
| `ALLOWED_REFERERS` | `""` | 否 | 防盗链白名单，逗号分隔，支持 `*.example.com`。为空表示不启用 Referer 限制。 | 生产环境建议配置为你的站点域名。 |
| `ALLOW_EMPTY_REFERER` | `"true"` | 否 | 当 Referer 为空时是否放行。 | 强防盗链可改为 `"false"`。 |
| `MAX_FILE_SIZE` | `"5242880"` | 否 | 单文件上传大小上限（字节），默认 5MB。 | 可根据业务改大或改小。 |
| `ALLOWED_ORIGINS` | `"*"` | 否 | CORS 允许源。`*` 表示允许全部来源。 | 生产环境建议改成显式域名白名单。 |
| `BASE_URL` | `""` | 否 | 返回图片 URL 时使用的基础地址。为空时使用请求 Host。 | 接入自定义域名时建议填写。 |
| `ENABLE_IMAGE_RESIZING` | `"false"` | 否 | 是否启用 `w/h/f/fit/preset` 等变换参数。 | 需要在线裁剪再改为 `"true"`。 |
| `RATE_LIMIT_UPLOADS_PER_MINUTE` | `"10"` | 否 | 上传接口限流（每 IP 每分钟）。 | 可按流量和风控需求调整。 |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | `"60"` | 否 | 图片访问限流（每 IP 每分钟）。 | 高并发场景通常需要提高。 |

### 资源绑定与迁移字段说明

| 字段 | 当前值 | 必填 | 详细说明 |
| --- | --- | --- | --- |
| `[[r2_buckets]].binding` | `IMAGE_BUCKET` | 是 | Worker 内访问 R2 的变量名，对应代码中的 `env.IMAGE_BUCKET`。 |
| `[[r2_buckets]].bucket_name` | `image-hosting` | 是 | Cloudflare 账号中的真实 R2 bucket 名称。 |
| `[[durable_objects.bindings]].name` | `RATE_LIMITER` | 是 | Worker 内访问 DO Namespace 的变量名，对应 `env.RATE_LIMITER`。 |
| `[[durable_objects.bindings]].class_name` | `RateLimitDurableObject` | 是 | 绑定到的 Durable Object 类名，需与代码导出一致。 |
| `[[migrations]].tag` | `v1` | 是 | 迁移版本标签。每次新增/变更 DO 类时应递增（如 `v2`）。 |
| `[[migrations]].new_sqlite_classes` | `["RateLimitDurableObject"]` | 取决于迁移 | 声明本次迁移要创建的 SQLite-backed DO 类。 |

`r2_buckets` 可选字段（当前配置未启用）：

- `jurisdiction`：指定 Bucket 所属司法辖区（若使用辖区限制）。
- `preview_bucket_name`：`wrangler dev` 预览时使用的 Bucket 名称。

R2 存储桶新增配置项（创建 Bucket 时设置）：

| 配置项 | CLI 参数 | 可选值 | 说明 |
| --- | --- | --- | --- |
| `Location` | `--location` | `apac` / `eeur` / `enam` / `weur` / `wnam` / `oc` | 位置提示。若不传，Cloudflare 自动选择（Automatic，推荐）。 |
| `Default Storage Class` | `--storage-class` | `Standard` / `Infrequent Access`（CLI 常用值：`Standard` / `InfrequentAccess`） | 默认存储类型。Infrequent Access 有 30 天最短存储周期和读取处理费。 |

Location 可选值对应区域：

- `apac`: Asia-Pacific
- `eeur`: Eastern Europe
- `enam`: Eastern North America
- `weur`: Western Europe
- `wnam`: Western North America
- `oc`: Oceania

示例（创建 Bucket 时同时指定）：

```bash
npx wrangler r2 bucket create image-hosting --location wnam --storage-class Standard
```

说明：

- 上述两项属于 Bucket 创建/属性级配置，不是 Worker 绑定字段。
- `wrangler.toml` 的 `[[r2_buckets]]` 里只需要绑定 `bucket_name`。

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

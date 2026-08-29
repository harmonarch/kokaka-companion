# AGENTS.md

## 沟通方式

- 对使用者回报时，使用中文，专有名词保留英文。
- 最终回复只写结论、实际改动、原因、验证结果。
- 不使用工程汇报腔，不描述不必要的过程。
- 需要列出多个方案时，说明每个方案的优缺点，并明确推荐方案。

## 目录结构

```txt
apps/api       Cloudflare Workers API
apps/mobile    Expo + React Native Web 原型
packages/shared 共享类型和协议
packages/api-client API 与 WebSocket client
packages/core  session 与聊天控制逻辑
```

## 开发原则

- 优先沿用现有代码风格和模块边界。
- TypeScript、TSX、JavaScript 与脚本代码不使用句尾分号；确实属于语法必需或非 TS/JS 语句分隔的分号可以保留。
- 共享请求、响应、WebSocket 消息结构时，先更新 `packages/shared` 的 Zod schema 和类型。
- API 行为变更需要同步更新 `packages/api-client`。
- 不要把本地临时文件、构建产物、密钥、`.wrangler/state` 提交进仓库。
- 不要覆盖使用者已有改动；修改前先看 `git status --short`。

## 已知注意事项

- `apps/mobile/expo-env.d.ts` 提供 `process.env` 类型声明，不要删除。
- `pnpm --filter @ai-companion/api build` 会执行 `wrangler deploy --dry-run`，本地可能因为 Wrangler 环境卡住；优先使用 API typecheck 和 test 做日常验证。
- WebSocket 当前使用 query token，后续需要升级鉴权方式。

## 部署准备清单

部署到 Cloudflare 前逐项确认，避免漏配 secret 或漏跑迁移：

- 首次部署前准备两份 secret 文件（git 忽略，复制自模板并填入真实值）：
  - `cp apps/api/.env.production.example apps/api/.env.production`
  - `cp apps/dashboard/.env.production.example apps/dashboard/.env.production`
  - 留空的 key 会被 `scripts/deploy-secrets.mjs` 跳过，不会写入。
- API 必填 secret：`JWT_SECRET`、`PASSWORD_HASH_SECRET`（生产环境用新的随机值，不要复用 `.env.example` 里的开发值）、`DEEPSEEK_API_KEY`。
- `MONITORING_API_KEY` 在 API 与 dashboard 两侧必须填同一个值，否则面板读不到监控数据。
- `DASHBOARD_ACCESS_PASSWORD` 是面板 Basic Auth 密码；用户名 `admin` 已写在 `wrangler.jsonc` 的 `vars` 里。
- 建议在 `wrangler.production.toml` 的 `[vars]` 里配置 `CORS_ALLOWED_ORIGINS`（逗号分隔的浏览器来源白名单，dashboard 与 mobile web 站点）；不配置则 API 对任意来源开放跨域。
- API 已配置每日 cron（`[triggers]`，凌晨 3 点）清理过期 refresh token 和 30 天前的会话观测数据，首次部署后无需手动执行。
- 先迁移数据库再部署 API：`pnpm --filter @ai-companion/api migrate:production`。
- secret 无需手动 `wrangler secret put`：`deploy:production` / `deploy:cloudflare` 会自动先执行 `deploy-secrets.mjs`。
- secret 只通过 `wrangler secret bulk` 注入，不要写进 `wrangler.jsonc` 或 `wrangler.production.toml`。

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

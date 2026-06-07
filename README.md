# kokaka

kokaka 是一个主打陪伴的 Agent 项目。

名字来自澳洲短尾矮袋鼠 quokka。它是一种看起来总是在微笑、很有治愈感的小动物。这个项目叫 kokaka，是希望它也能像那样，成为一个能让人放松一点、被接住一点的陪伴型 Agent。

## 项目目标

kokaka 希望成为一个能倾听、能记忆、能理解、能支持的陪伴 Agent。

它希望在用户需要表达、整理情绪、获得回应的时候，提供稳定、温和、有支持的陪伴。

当前 P0 版本的重点是跑通最小可用原型：用户可以注册登录，进入聊天，发送消息，收到流式 Agent 回复，并完成账号资料和数据清理。

## 功能列表

| 功能                                                      | 状态 |
| --------------------------------------------------------- | ---- |
| 登录状态刷新                                              | ✅   |
| 退出登录                                                  | ✅   |
| 设置昵称                                                  | ✅   |
| 注销账号                                                  | ✅   |
| 注销后清理 refresh token                                  | ✅   |
| 注销后清理短期聊天上下文                                  | ✅   |
| WebSocket 聊天                                            | ✅   |
| Agent 流式回复                                            | ✅   |
| 最近对话上下文保存                                        | ✅   |
| `normal`、`vulnerable`、`crisis`、`positive` 四类状态识别 | ✅   |
| `vulnerable` 状态下避免说教和直接建议                     | ✅   |
| DeepSeek 回复生成                                         | ✅   |
| Expo + React Native Web 原型                              | ✅   |
| 长期记忆系统                                              | ✅   |
| 用户查看、编辑、删除记忆                                  | □    |
| Vectorize 混合检索                                        | ✅   |
| 主题聚类                                                  | □    |
| 多主题分段回复                                            | □    |
| 主动推送                                                  | □    |
| 亲密度模型                                                | □    |
| 语音输入                                                  | □    |
| 文件上传                                                  | □    |
| 正式 App 端                                               | □    |

## 技术栈

| 模块       | 技术                         |
| ---------- | ---------------------------- |
| Monorepo   | pnpm workspace + Turborepo   |
| API        | Cloudflare Workers + Hono    |
| WebSocket  | Cloudflare Workers WebSocket |
| 数据库     | Wrangler 本地 D1 + Drizzle   |
| 短期上下文 | Cloudflare KV                |
| Web 原型   | Expo + React Native Web      |
| 状态管理   | Zustand                      |
| 共享类型   | TypeScript + Zod             |
| Agent 管线 | LangGraph TypeScript         |
| LLM        | DeepSeek                     |

## 安装使用

### 1. 安装依赖

```sh
pnpm install
```

### 2. 准备环境变量

准备环境变量并且配置 DeepSeek API Key：

```sh
pnpm setup:env --deepseek-api-key=你的 DeepSeek API Key
```

`apps/api/.env.example` 已经提供本地开发可用的 `JWT_SECRET` 和 `PASSWORD_HASH_SECRET`。正式部署时再替换成新的随机值。

### 3. 创建本地 D1 数据表

```sh
pnpm --filter @ai-companion/api exec wrangler d1 migrations apply ai-companion-local --local
```

### 4. 启动 API

```sh
pnpm dev:api
```

默认地址：

```txt
http://localhost:8787
```

### 5. 启动 Web 原型

```sh
pnpm dev:mobile
```

Expo 会在终端输出本地 Web 地址，通常是：

```txt
http://localhost:8081
```

## 本地验证

```sh
pnpm typecheck
pnpm test
pnpm build
```

## 记忆架构

当前记忆分层：

| 数据                 | 存放位置                    | 原因                                               |
| -------------------- | --------------------------- | -------------------------------------------------- |
| 最近 20 条聊天上下文 | KV `ctx:{userId}`           | 高频读取、短期有效                                 |
| 当前情绪状态         | KV `mood:{userId}`          | 高频更新、短期有效                                 |
| 长期记忆热缓存       | KV `ltm:{userId}`           | 每轮对话都会读取，缓存用户画像、最近记忆和近期摘要 |
| 用户画像             | D1 `user_profiles`          | 结构化字段，需要更新和条件读取                     |
| 长期记忆条目         | D1 `memories`               | 需要按用户、类型、时间查询                         |
| 对话摘要             | D1 `conversation_summaries` | 需要按用户、会话、时间查询                         |
| 聊天历史             | D1 `chat_messages`          | 需要分页和时间排序                                 |

已补齐的架构检查项：

| 检查项                                                       | 状态 |
| ------------------------------------------------------------ | ---- |
| 用户画像、最近记忆和近期摘要优先读取 KV 热缓存               | ✅   |
| 长期记忆开关仍以 D1 为准                                     | ✅   |
| 长期记忆写入后清理 KV 热缓存                                 | ✅   |
| 关闭长期记忆后不读取旧缓存                                   | ✅   |
| 注销账号后清理短期上下文、情绪状态和长期记忆热缓存           | ✅   |
| 近期摘要具备 `user_id + end_time` 查询索引                   | ✅   |
| 对话摘要具备 `user_id + conversation_id + end_time` 查询索引 | ✅   |

对照《混合记忆架构设计》后的实现状态：

| 文章要求                                         | 当前状态                                      |
| ------------------------------------------------ | --------------------------------------------- |
| KV 存高频短期上下文                              | ✅ 已实现                                     |
| D1 存结构化画像、记忆条目、对话摘要              | ✅ 已实现                                     |
| 结构化查询通道                                   | ✅ 已实现，画像字段精确查询                   |
| 时间范围查询通道                                 | ✅ 已实现，基于对话摘要查询                   |
| 关键词检索通道                                   | ✅ 已实现，基于 D1 记忆表 `LIKE` 查询         |
| 结果融合：去重、来源加权、时效性加成、Top-K 截断 | ✅ 已实现                                     |
| 同步写入 KV 短期上下文                           | ✅ 已实现                                     |
| 事实覆盖写入 D1 画像表                           | ✅ 已实现                                     |
| 事件、偏好追加写入 D1 记忆表                     | ✅ 已实现                                     |
| 每 N 轮生成摘要并写入 D1 摘要表                  | ✅ 已实现                                     |
| 语义检索通道                                     | ✅ 已实现，配置 Vectorize 和 embedding 后启用 |
| 事件记忆双写 D1 + Vectorize                      | ✅ 已实现，未配置 Vectorize 时自动降级        |
| LLM 查询理解                                     | ✅ 已实现，未配置 LLM 时使用规则降级          |

## 项目结构

```txt
kokaka/
├── apps/
│   ├── api/              # Cloudflare Workers API
│   └── mobile/           # Expo + React Native Web 原型
├── packages/
│   ├── shared/           # 共享类型和协议
│   ├── api-client/       # API 与 WebSocket client
│   └── core/             # session 与聊天控制逻辑
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

## 当前限制

- 目前是 P0 Web 原型，不是正式产品。
- D1 默认使用 Wrangler 本地环境。
- WebSocket 鉴权当前使用 query token，后续需要升级。
- 长期记忆目前支持画像、事件、偏好、情绪快照和对话摘要；还没有用户侧查看、编辑、删除记忆界面。
- `crisis` 状态只做基础识别和回应，不等同于专业危机干预。

## License

MIT

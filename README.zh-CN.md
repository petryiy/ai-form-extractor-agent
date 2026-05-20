# AI 需求获取代理

[English README](./README.md)

AI 需求获取代理是一个面向 B2B SaaS 的客户需求收集系统。它让客户通过自然语言和 AI 对话，而不是填写冗长表单；系统会在后台把对话整理成经过 Zod 校验的结构化需求报告，供你的团队在后台查看。

## 这个项目是做什么的

很多客户一开始并不清楚自己真正想要什么，也很难一次性填完整表单。这个系统的目标是让 AI 像业务分析师一样，通过自然对话逐步挖掘客户需求，同时在后台生成可靠的 JSON report。

它可以帮助你收集：

- 核心痛点
- 为什么现在要解决，也就是购买触发事件
- 当前使用的 App、表格、人工流程或竞品替代方案
- 更具体的使用链路和真实工作场景
- 使用者、审批者、买单者和潜在阻力
- 必须具备功能和锦上添花功能
- 预算、时间线、集成、限制条件和成功指标

## 核心功能

- 客户聊天入口：`/`
- 内部需求表收件箱：`/admin`
- AI 自然追问，不像问卷一样逐条盘问
- 后台自动抽取结构化需求表
- 所有 AI 抽取结果都经过 Zod 校验
- 生产环境使用 Supabase 保存 report
- 本地开发可自动 fallback 到 `.data/requirement-sessions.json`
- 支持中文和英文客户
- 默认使用 DeepSeek OpenAI-compatible API
- 可选 Webhook，把完成的 report 推送到外部系统

## 技术栈

- Next.js App Router
- React
- TypeScript
- Vercel AI SDK
- DeepSeek OpenAI-compatible API
- Zod
- Supabase Postgres
- Vercel

## 页面

```text
/        客户聊天页面
/admin   内部 report 后台
```

客户页面不会展示隐藏 JSON。`/admin` 可以通过环境变量启用 Basic Auth。

## 中英双语支持

系统现在可以给中文和英文用户使用：

- 首次访问时根据浏览器语言自动选择中文或英文
- 页面右上角可以手动切换 EN / 中文
- AI 会根据客户最近一条实质性消息的语言回复
- 后台 JSON 字段名保持英文，方便工程和数据库使用

## 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开：

```text
http://localhost:3000/
http://localhost:3000/admin
```

## 环境变量

```env
DEEPSEEK_API_KEY=你的_deepseek_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash

SUPABASE_URL=https://你的项目.supabase.co
SUPABASE_SERVICE_ROLE_KEY=你的_service_role_key

ADMIN_USERNAME=admin
ADMIN_PASSWORD=强密码
```

可选 Webhook：

```env
REQUIREMENT_WEBHOOK_URL=https://example.com/webhook
REQUIREMENT_WEBHOOK_SECRET=shared-secret
REQUIREMENT_WEBHOOK_MODE=complete
```

`REQUIREMENT_WEBHOOK_MODE=complete` 表示只在必填字段齐全时推送；设为 `always` 则每次更新都推送。

## Supabase 配置

1. 创建 Supabase 项目。
2. 打开 Supabase SQL Editor。
3. 执行 [`supabase/schema.sql`](./supabase/schema.sql) 里的全部 SQL。
4. 在 `.env.local` 和 Vercel 环境变量里配置：

```env
SUPABASE_URL=https://你的项目.supabase.co
SUPABASE_SERVICE_ROLE_KEY=你的_service_role_key
```

配置 Supabase 后，report 会写入：

```text
public.requirement_sessions
```

如果没有配置 Supabase，本地开发会保存到：

```text
.data/requirement-sessions.json
```

## 部署到 Vercel

推荐流程：

1. 把项目推到 GitHub。
2. 在 Vercel 里 Import 这个 GitHub repo。
3. 添加上面的环境变量。
4. 点击 Deploy。

部署后：

- 把 `https://你的域名.vercel.app/` 发给客户
- 你自己打开 `https://你的域名.vercel.app/admin` 查看 report

## 生产构建检查

```bash
npm run build:isolated
npm run start:isolated -- -H 127.0.0.1 -p 3002
```

## 架构

```text
客户聊天页面
  -> /api/requirements/extract
     -> DeepSeek JSON Output
     -> Zod 校验
     -> Supabase 或本地存储
  -> /api/chat
     -> 流式 AI 业务分析师回复

内部后台
  -> /api/sessions
  -> /api/sessions/[sessionId]
```

关键文件：

- [`app/components/RequirementAgent.tsx`](./app/components/RequirementAgent.tsx)：客户聊天 UI
- [`app/admin/AdminDashboard.tsx`](./app/admin/AdminDashboard.tsx)：内部 report 后台
- [`app/api/requirements/extract/route.ts`](./app/api/requirements/extract/route.ts)：结构化抽取 API
- [`lib/requirements/schema.ts`](./lib/requirements/schema.ts)：Zod Criteria schema
- [`lib/ai/prompts.ts`](./lib/ai/prompts.ts)：AI 抽取和对话提示词
- [`lib/server/session-store.ts`](./lib/server/session-store.ts)：存储路由
- [`lib/server/supabase-session-store.ts`](./lib/server/supabase-session-store.ts)：Supabase 存储实现

## 安全注意事项

- 不要把 `SUPABASE_SERVICE_ROLE_KEY` 暴露到前端
- 部署前一定要设置 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD`
- DeepSeek 和 Supabase 密钥都只放在服务端环境变量里
- SQL schema 已开启 Supabase Row Level Security

## License

默认作为私有/内部项目使用。如果要公开开源，请先补充 license。

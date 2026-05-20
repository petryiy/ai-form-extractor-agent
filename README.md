# AI Requirement Elicitation Agent

A B2B SaaS core workflow for collecting customer requirements through guided AI conversation while maintaining a separate, Zod-validated requirement state.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `DEEPSEEK_API_KEY` in `.env.local`. The default provider is DeepSeek's OpenAI-compatible API with `deepseek-v4-flash`.

Customer intake page:

```text
http://localhost:3000/
```

Internal inbox:

```text
http://localhost:3000/admin
```

Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` to protect `/admin` with Basic Auth.

To send completed requirement forms to another system, set `REQUIREMENT_WEBHOOK_URL`. By default it only sends when all required fields are complete. Set `REQUIREMENT_WEBHOOK_MODE=always` to send every update.

If a local dev watcher is already running and you want an isolated production check:

```bash
npm run build:isolated
npm run start:isolated -- -p 3002
```

## Architecture

- `app/components/RequirementAgent.tsx`: customer chat UI and local session recovery.
- `app/admin/AdminDashboard.tsx`: internal inbox for AI-filled requirement forms.
- `app/api/requirements/extract/route.ts`: tool-calling extraction pass that updates only validated requirement fields.
- `app/api/chat/route.ts`: streaming analyst response for the visible conversation.
- `app/api/sessions/route.ts`: saved backend requirement session list.
- `app/api/sessions/[sessionId]/route.ts`: JSON snapshot endpoint for saved backend requirement sessions.
- `lib/server/requirement-webhook.ts`: optional webhook delivery for completed forms.
- `lib/requirements/*`: Criteria schema, state machine helpers, and API contracts.
- `lib/ai/*`: provider config and prompts.

Local session snapshots are written to `.data/requirement-sessions.json`. Replace `lib/server/session-store.ts` with a database adapter for production multi-instance deployments.
# ai-form-extractor-agent

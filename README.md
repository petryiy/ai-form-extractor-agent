# AI Requirement Elicitation Agent

[中文说明](./README.zh-CN.md)

AI Requirement Elicitation Agent is a B2B SaaS intake system that turns free-form customer conversations into validated, structured requirement reports.

Instead of asking prospects to fill out long forms, the customer talks to an AI business analyst. The system silently extracts qualification, product, workflow, and buying-process data into a Zod-validated JSON report. Your team can review every report in an internal admin inbox.

## What It Does

- Provides a customer-facing AI chat page at `/`
- Guides users through natural requirement discovery without sounding like a questionnaire
- Extracts structured requirement data in the background
- Validates all extracted data with Zod before saving
- Stores reports in Supabase for production, with local file fallback for development
- Provides an internal report inbox at `/admin`
- Supports both English and Chinese users
- Uses DeepSeek's OpenAI-compatible API by default
- Can optionally push completed reports to an external webhook

## Use Case

This project is useful when your customers do not know exactly what they need yet.

The AI helps uncover:

- Core pain points
- Why the customer is looking now
- Existing tools or alternatives
- Specific workflows and usage scenarios
- Buyer, approver, and end-user roles
- Required vs. nice-to-have features
- Budget, timeline, integrations, constraints, and success metrics

The goal is to help sales, product, and delivery teams qualify opportunities faster and avoid vague or incomplete project briefs.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Vercel AI SDK
- DeepSeek OpenAI-compatible API
- Zod
- Supabase Postgres
- Vercel deployment

## Pages

```text
/        Customer-facing chat experience
/admin   Internal requirement report inbox
```

The customer page does not expose the hidden JSON report. The admin page is protected with optional HTTP Basic Auth.

## Bilingual Support

The customer-facing UI supports English and Chinese:

- Browser language is detected on first visit
- Users can switch between English and Chinese in the UI
- The AI replies in the customer's latest message language
- Structured JSON keys stay stable in English for engineering and database use

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open:

```text
http://localhost:3000/
http://localhost:3000/admin
```

## Environment Variables

```env
DEEPSEEK_API_KEY=your-deepseek-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash

SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

ADMIN_USERNAME=admin
ADMIN_PASSWORD=use-a-strong-password
```

Optional webhook:

```env
REQUIREMENT_WEBHOOK_URL=https://example.com/webhook
REQUIREMENT_WEBHOOK_SECRET=shared-secret
REQUIREMENT_WEBHOOK_MODE=complete
```

`REQUIREMENT_WEBHOOK_MODE=complete` sends only completed reports. Use `always` to send every update.

## Supabase Setup

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Run the full contents of [`supabase/schema.sql`](./supabase/schema.sql).
4. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` and Vercel.

When Supabase variables are present, reports are stored in `public.requirement_sessions`.

Without Supabase variables, local development falls back to:

```text
.data/requirement-sessions.json
```

## Deploy to Vercel

Recommended deployment path:

1. Push this repository to GitHub.
2. Import the repository in Vercel.
3. Add the environment variables above.
4. Deploy.

After deployment:

- Send customers `https://your-domain.vercel.app/`
- Review reports at `https://your-domain.vercel.app/admin`

## Production Check

```bash
npm run build:isolated
npm run start:isolated -- -H 127.0.0.1 -p 3002
```

## Architecture

```text
Customer Chat UI
  -> /api/requirements/extract
     -> DeepSeek JSON Output
     -> Zod validation
     -> Supabase or local session store
  -> /api/chat
     -> streaming analyst response

Admin Inbox
  -> /api/sessions
  -> /api/sessions/[sessionId]
```

Key files:

- [`app/components/RequirementAgent.tsx`](./app/components/RequirementAgent.tsx): customer chat UI
- [`app/admin/AdminDashboard.tsx`](./app/admin/AdminDashboard.tsx): internal inbox
- [`app/api/requirements/extract/route.ts`](./app/api/requirements/extract/route.ts): structured extraction API
- [`lib/requirements/schema.ts`](./lib/requirements/schema.ts): Zod Criteria schema
- [`lib/ai/prompts.ts`](./lib/ai/prompts.ts): extraction and conversation prompts
- [`lib/server/session-store.ts`](./lib/server/session-store.ts): persistence router
- [`lib/server/supabase-session-store.ts`](./lib/server/supabase-session-store.ts): Supabase persistence

## Security Notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser
- Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` before deployment
- Keep DeepSeek and Supabase keys in server-side environment variables
- Supabase Row Level Security is enabled in the provided schema

## License

Private/internal by default. Add a license before publishing as open source.

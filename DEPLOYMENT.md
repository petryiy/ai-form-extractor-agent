# Deployment

Use Vercel for the Next.js app and Supabase for persistent reports.

## 1. Create the Supabase table

1. Open your Supabase project.
2. Go to SQL Editor.
3. Run the full contents of `supabase/schema.sql`.

The table is `public.requirement_sessions`. Browser access is blocked by RLS; the server writes with the Supabase service role key.

## 2. Add Vercel environment variables

In Vercel Project Settings, add:

```env
DEEPSEEK_API_KEY=your-deepseek-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash

SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

ADMIN_USERNAME=admin
ADMIN_PASSWORD=use-a-strong-password
```

Optional:

```env
REQUIREMENT_WEBHOOK_URL=https://example.com/webhook
REQUIREMENT_WEBHOOK_SECRET=shared-secret
REQUIREMENT_WEBHOOK_MODE=complete
```

## 3. Deploy to Vercel

Recommended path:

1. Push this project to GitHub.
2. Import the GitHub repo in Vercel.
3. Add the environment variables above.
4. Deploy.

After deploy:

- Send customers `https://your-domain.vercel.app/`
- Open your admin inbox at `https://your-domain.vercel.app/admin`

## 4. Local production check

```bash
npm run build:isolated
npm run start:isolated -- -H 127.0.0.1 -p 3002
```

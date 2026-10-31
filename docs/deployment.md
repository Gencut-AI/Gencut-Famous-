# Deployment

| Piece | Where | Status (31 Oct 2026) |
| --- | --- | --- |
| Database | Supabase project "GenCut Creators" (`kwbttmmadzxlbplqgrvi`, us-east-1, free plan) | Created; migrations 0001–0004 applied |
| Code | GitHub `Gencut-AI/Gencut-Famous-` | Pushed (main) |
| Web | Netlify project `gencut-famous` (`gencut-famous.netlify.app`, team XR-, free plan) | Created; public Supabase values and app secrets set; waiting for the repo link and `DATABASE_URL` |
| Domain | `gencut.ai` for media kits | Not attached |

Netlify environment variables: see `.env.example`. `DATABASE_URL` is the Supabase pooler connection string (Project settings → Database); the database password is set or reset there. Supabase Auth: add the site URL and `https://<site>/auth/confirm` to the redirect allow-list; the email template's link should use the token hash (`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`).

Migrations: `DATABASE_URL=<direct connection> pnpm db:migrate`.

## Linking the repository (one time, in the Netlify UI)

Project `gencut-famous` → Project configuration → Build & deploy → Continuous deployment → Link repository → GitHub → `Gencut-AI/Gencut-Famous-`, branch `main`, base directory empty, package directory `apps/web`. The build command and functions directory come from `apps/web/netlify.toml`. Every push to `main` then deploys.

Variables already set on the site: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `GENCUT_TOKEN_KEYS`, `GENCUT_STATE_SECRET`, `GENCUT_VISIT_SECRET`, `GENCUT_INSTAGRAM_ACCESS=testers`. Netlify's free plan does not allow the "secret" flag, so they are ordinary site variables. Still needed: `DATABASE_URL`, then `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET`, optionally `ANTHROPIC_API_KEY` and `GENCUT_PUBLIC_URL`.

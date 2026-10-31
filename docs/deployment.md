# Deployment

| Piece | Where | Status (31 Oct 2026) |
| --- | --- | --- |
| Database | Supabase project "GenCut Creators" (`kwbttmmadzxlbplqgrvi`, us-east-1, free plan) | Created; migrations 0001–0004 applied |
| Code | GitHub `Gencut-AI/Gencut-Famous-` | Pushed (main) |
| Web | Netlify (new site, package directory `apps/web`) | Not created |
| Domain | `gencut.ai` for media kits | Not attached |

Netlify environment variables: see `.env.example`. `DATABASE_URL` is the Supabase pooler connection string (Project settings → Database); the database password is set or reset there. Supabase Auth: add the site URL and `https://<site>/auth/confirm` to the redirect allow-list; the email template's link should use the token hash (`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`).

Migrations: `DATABASE_URL=<direct connection> pnpm db:migrate`.

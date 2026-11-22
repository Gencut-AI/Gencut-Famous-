# Deployment

| Piece | Where | Status (31 Oct 2026) |
| --- | --- | --- |
| Database | Supabase project "GenCut Creators" (`kwbttmmadzxlbplqgrvi`, us-east-1, free plan) | Created; migrations 0001–0004 applied |
| Code | GitHub `Gencut-AI/Gencut-Famous-` | Pushed (main) |
| Web | Netlify project `gencutfamous` (`gencutfamous.netlify.app`, team XR-, free plan), linked to this repo (`main`) | Live; settings copied 1 Nov. An empty project `gencut-famous` created earlier is unused and can be deleted. |
| Domain | `gencut.ai` for media kits | Not attached |

Netlify environment variables: see `.env.example`. `DATABASE_URL` is the Supabase pooler connection string (Project settings → Database); the database password is set or reset there. Supabase Auth: add the site URL and `https://<site>/auth/confirm` to the redirect allow-list; the email template's link should use the token hash (`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`).

Migrations: `DATABASE_URL=<direct connection> pnpm db:migrate`.

## Linking the repository (one time, in the Netlify UI)

Project `gencutfamous` → Project configuration → Build & deploy → Continuous deployment → Link repository → GitHub → `Gencut-AI/Gencut-Famous-`, branch `main`, base directory empty, package directory `apps/web`. The build command and functions directory come from `apps/web/netlify.toml`. Every push to `main` then deploys.

Variables already set on the site: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `GENCUT_TOKEN_KEYS`, `GENCUT_STATE_SECRET`, `GENCUT_VISIT_SECRET`, `GENCUT_INSTAGRAM_ACCESS=testers`. Netlify's free plan does not allow the "secret" flag, so they are ordinary site variables. Still needed: `DATABASE_URL`, then `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET`, optionally `ANTHROPIC_API_KEY` and `GENCUT_PUBLIC_URL`.

## Supabase sign-in email templates (one time, in the Supabase dashboard)

Authentication → Emails → Templates. Set **Magic Link** and **Confirm signup** to the same body (D-011). Subject: `Your GenCut Famous sign-in`. The body says 24 hours because Email OTP expiration is 86400 (D-014).

```html
<h2>Sign in to GenCut Famous</h2>
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Sign in</a></p>
<p>Or type this code on the sign-in screen: <strong>{{ .Token }}</strong></p>
<p>The link and code work for 24 hours. If you didn't ask to sign in, ignore this email.</p>
```

`{{ .RedirectTo }}` is the `emailRedirectTo` the app sends (`/auth/confirm?next=…`), so it already has a `?` and the template appends with `&`. It must match the redirect allow-list (`https://gencutfamous.netlify.app/**`).

## Sign-in for the beta (one time; D-014)

**Links that last a day.** Supabase → Authentication → Sign In / Providers → Email → *Email OTP Expiration* = `86400`. Set both templates above (Magic Link **and** Confirm signup), so new people get the code too.

**Inbox, not spam.** Add a DMARC record where gencut.ai's DNS is managed: name `_dmarc`, type TXT, value `v=DMARC1; p=none; rua=mailto:dmarc@gencut.ai` (any mailbox you read). Resend already signs mail for mail.gencut.ai (DKIM and SPF are in place).

**Continue with Google.**
1. Google Cloud console → APIs & Services → OAuth consent screen: app name *GenCut Famous*, support email, logo optional, authorized domain `supabase.co` and `netlify.app`; publish the app (scopes are only email and profile, so no Google review).
2. Credentials → Create credentials → OAuth client ID → Web application. Authorized redirect URI: `https://kwbttmmadzxlbplqgrvi.supabase.co/auth/v1/callback`. Copy the client ID and secret.
3. Supabase → Authentication → Sign In / Providers → Google: enable, paste the client ID and secret, save.
4. Netlify (gencutfamous) → Environment variables: `GENCUT_GOOGLE_SIGNIN=on`, then redeploy. `/api/health` shows `"googleSignIn":"on"`.

## Limits to raise before 100 creators (D-015)

| Where | Setting | Why |
| --- | --- | --- |
| Supabase → Authentication → Rate Limits | *Rate limit for sending emails*: at least 100 per hour | Every email sign-in is one email; an influencer's post can bring dozens of sign-ups in an hour. Configurable only with custom SMTP, which is set. |
| Resend → Billing | Free plan sends 100 emails a day and 3,000 a month; move to a paid plan before a launch post | Sign-in emails and inquiry alerts share this cap. Google sign-in sends no email. |
| Supabase → Billing | Paid plan | Free projects pause after a week of low activity and hold 500 MB; at 100 creators the daily Instagram readings reach that in about three months. |
| Meta | App Review with Advanced Access (docs/meta-app-review.md) | Until then, each creator must be added and accept an Instagram Tester invite. |

# Integrations

## Instagram (built, not yet verified live)

Two Meta setups are supported; `INSTAGRAM_CONFIG_ID` chooses.

**Unified Login (Meta apps created from late 2026; GenCut's app, 13 Nov 2026).** New Meta apps no longer offer "API setup with Instagram login". The creator signs in with Instagram or Facebook in Meta's dialog (`facebook.com/dialog/oauth` with `config_id`, `display=popup`, `override_default_response_type=true`, `prompt=login`, as in the Login URL the dashboard generates), chooses the Instagram professional account, and GenCut exchanges the code on `graph.facebook.com/v26.0/oauth/access_token`. `debug_token` gives the granted permissions and the expiry. The chosen Instagram account is found through `me/assigned_instagram_accounts`, then `debug_token`'s `granular_scopes`, then `me?fields=client_business_id` → `{business}/owned_instagram_accounts`, then Page-linked accounts (the first live connection on 13 Nov returned none from `granular_scopes` or Pages); a failure lists what each lookup returned. a business (system-user) token does not expire, a user token is exchanged for a 60-day one. Data calls go to `graph.facebook.com/v26.0/{ig-id}` with the token in the header and `appsecret_proof`. Permissions: `instagram_basic`, `instagram_manage_insights` (the same as `instagram_business_*` under Instagram Login; checks treat them as equal, `packages/core/src/connectors/instagram.ts`). Client: `packages/services/src/connectors/instagram-unified-api.ts`. Not every response shape is documented by Meta yet; verify the first live connection.

Set up in the Meta App Dashboard (app must belong to a business portfolio):

1. Instagram use case → Customize → Permissions and features: add `instagram_basic` and `instagram_manage_insights`.
2. API setup with Unified login → Create new configuration with only those two permissions and the Instagram account asset; copy the Configuration ID into Netlify as `INSTAGRAM_CONFIG_ID`.
3. Same page → Register a new redirect URL: `https://<site>/api/connect/instagram/callback`.
4. App settings → Basic: privacy `https://<site>/privacy`, terms `https://<site>/terms`, data deletion `https://<site>/data-deletion`; `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` in Netlify are this page's App ID and App secret (secret flag on the secret only).
5. Deauthorize and data-deletion callbacks (Facebook Login for Business settings, if offered): `https://<site>/api/meta/deauthorize`, `https://<site>/api/meta/data-deletion`.
6. App roles → Roles: add the creator's Instagram account as an Instagram Tester; they accept in Instagram → Settings → Website permissions → Apps and websites → Tester invites.

**Instagram Login (older apps).** API: Instagram API with Instagram Login, `graph.instagram.com/v26.0`. Scopes: `instagram_business_basic`, `instagram_business_manage_insights`. Creator or Business accounts only. Redirect URI `https://<site>/api/connect/instagram/callback`, deauthorize `https://<site>/api/meta/deauthorize`, data deletion `https://<site>/api/meta/data-deletion`; `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` are the Instagram app id and secret.

Until App Review (Advanced Access) and business verification are approved, only testers can connect; keep `GENCUT_INSTAGRAM_ACCESS=testers`.

What is read: `/me` (username, account type, followers, following, posts), account insights `reach, views, accounts_engaged, total_interactions` with `metric_type=total_value` for yesterday and the last 7 days, the 25 most recent posts, and per-post insights for feed posts and reels. Carousels get no insights from Meta; their like and comment counts are shown instead. Instagram Login has no token-revoke call; disconnecting deletes GenCut's token and the page tells the creator where to remove the app in Instagram.

Sources (read 31 Oct 2026): [Business Login for Instagram](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login), [Account insights](https://developers.facebook.com/docs/instagram-platform/api-reference/instagram-user/insights), [Media insights](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights/).

## Roadmap connectors

YouTube (Google OAuth, `youtube.readonly` + `yt-analytics.readonly`, Google verification), TikTok (Login Kit, per-scope review; posts private until audit), Threads (same Meta app), Facebook Pages, LinkedIn (Community Management API, Standard tier review), X (paid per call; deferred). Each needs a manifest in `packages/core/src/connectors/` (replace the `planned` entry) and a client in `packages/services/src/connectors/`.

## Email (Resend)

Sign-in emails go through Supabase Auth's custom SMTP (Resend, sender on `mail.gencut.ai`). New-inquiry emails are sent by the app itself through Resend's HTTP API (`packages/services/src/email.ts`, behind the `EmailSender` interface): set `RESEND_API_KEY` (a sending-only key) and `GENCUT_EMAIL_FROM` (`Display Name <name@…>` on the verified `mail.gencut.ai` domain; not a secret, so leave Netlify's "Contains secret values" unticked: Netlify's secret scan fails the build when a secret value also appears in the repository) in Netlify, then redeploy. Production uses a `notifications` address on that domain (13 Nov 2026). The email goes to every team member (owner and managers) with reply-to set to the sender, who agreed to be contacted by email. A failed send is audited as `notify_failed` and never loses the inquiry, which is always in the app.


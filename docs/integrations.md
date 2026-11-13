# Integrations

## Instagram (built, not yet verified live)

API: Instagram API with Instagram Login, `graph.instagram.com/v26.0`. Scopes: `instagram_business_basic`, `instagram_business_manage_insights`. Creator or Business accounts only.

Set up in the Meta App Dashboard (Instagram product → API setup with Instagram login):

1. OAuth redirect URI: `https://<site>/api/connect/instagram/callback`
2. Deauthorize callback URL: `https://<site>/api/meta/deauthorize`
3. Data deletion request URL: `https://<site>/api/meta/data-deletion`
4. Privacy policy URL: `https://<site>/privacy`; Terms: `https://<site>/terms`
5. Add the creator's Instagram account as an Instagram tester (App roles), and accept the invitation in Instagram.
6. Put the Instagram app id and secret in Netlify as `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET`.

Until App Review (Advanced Access) and business verification are approved, only testers can connect; keep `GENCUT_INSTAGRAM_ACCESS=testers`.

What is read: `/me` (username, account type, followers, following, posts), account insights `reach, views, accounts_engaged, total_interactions` with `metric_type=total_value` for yesterday and the last 7 days, the 25 most recent posts, and per-post insights for feed posts and reels. Carousels get no insights from Meta; their like and comment counts are shown instead. Instagram Login has no token-revoke call; disconnecting deletes GenCut's token and the page tells the creator where to remove the app in Instagram.

Sources (read 31 Oct 2026): [Business Login for Instagram](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login), [Account insights](https://developers.facebook.com/docs/instagram-platform/api-reference/instagram-user/insights), [Media insights](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights/).

## Roadmap connectors

YouTube (Google OAuth, `youtube.readonly` + `yt-analytics.readonly`, Google verification), TikTok (Login Kit, per-scope review; posts private until audit), Threads (same Meta app), Facebook Pages, LinkedIn (Community Management API, Standard tier review), X (paid per call; deferred). Each needs a manifest in `packages/core/src/connectors/` (replace the `planned` entry) and a client in `packages/services/src/connectors/`.

## Email (Resend)

Sign-in emails go through Supabase Auth's custom SMTP (Resend, sender on `mail.gencut.ai`). New-inquiry emails are sent by the app itself through Resend's HTTP API (`packages/services/src/email.ts`, behind the `EmailSender` interface): set `RESEND_API_KEY` (a sending-only key) and `GENCUT_EMAIL_FROM` (an address on the verified domain, e.g. `GenCut Famous <notifications@mail.gencut.ai>`) in Netlify, then redeploy. The email goes to every team member (owner and managers) with reply-to set to the sender, who agreed to be contacted by email. A failed send is audited as `notify_failed` and never loses the inquiry, which is always in the app.


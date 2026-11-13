# Architecture decisions

Each entry: date, decision, why, and what would make us revisit it. Newest last.

## D-001 · 2026-10-31 · A separate app, built from GenCut Properties' foundations

**Decision (Paul, 31 Oct):** GenCut Famous is its own repository (`Gencut-AI/Gencut-Famous-`), Supabase project ("GenCut Creators") and Netlify site, not a vertical inside GenCut Properties. The new codebase copies the proven foundations — monorepo layout, pure `core` package, SQL-first migrations and runner, service-layer authorization, append-only audit log, ModelRouter, CI with gitleaks, repository lint, Supabase email-link auth plumbing, Netlify function bundler — and the engineering rules. No real-estate code was copied; the visual identity is GenCut Famous's own (D-009).
**Why:** Paul wants the two products independent for now; a master info website will link both. Starting from the same foundations keeps the engineering rules identical and a later merge possible.
**Revisit if:** the two products need shared accounts or shared data (one sign-in across both), or duplicated foundation code starts to drift.

## D-002 · 2026-10-31 · One workspace per creator; owner and manager roles

**Decision:** a workspace is one creator. Roles: `owner` (the creator, exactly one, enforced by a unique index) and `manager`. Capabilities live in `core/roles.ts`: managers can view, edit the profile, manage channels and publish the media kit; only owners manage the team and delete data. Managers join by a one-time link (SHA-256 hash stored, 7 days, single use, bound to the invited email). GenCut sends no email, so the owner shares the link. A manager can work on several creators; the chosen one is a cookie re-checked against memberships on every request.
**Why:** the directive asks for creator and authorized manager roles; managers who represent several creators are common.

## D-003 · 2026-10-31 · Database closed to the public API; authorization in services

**Decision:** as in Properties, the server connects to Postgres directly and every service checks membership and capability. RLS is enabled with no policies on every table, so Supabase's Data API (anon / authenticated keys) can read or write nothing. The Supabase advisor's "RLS enabled, no policy" notices are therefore expected.
**Why:** one enforcement path, testable with plain SQL; nothing needs browser-side database access.
**Revisit if:** a table must be read from the browser directly; then add explicit policies for that table only.

## D-004 · 2026-10-31 · Instagram first, read-only, through Instagram Login

**Decision:** the first connector is Instagram API with Instagram Login (`instagram_business_basic`, `instagram_business_manage_insights`), read-only. Long-lived tokens (60 days) are encrypted with AES-256-GCM (`GENCUT_TOKEN_KEYS`, key id per row for rotation; channel id as associated data) and refreshed after 7 days. OAuth `state` is HMAC-signed, expires in 10 minutes and is bound to the user, the creator and an HttpOnly nonce cookie. Connection state is computed from the granted scopes and the manifest (seven states); a personal account is refused. Until Meta approves App Review, only accounts added as testers can connect, and the Channels page says so (`GENCUT_INSTAGRAM_ACCESS=testers`).
**Why:** Instagram is where most creators' brand deals are sized; an Instagram client already existed in Properties (D-024 there); it shares Meta's review with any later Threads or Facebook connector.
**Revisit when:** Meta approves Advanced Access (switch to `public`), or YouTube is added (Google OAuth, same framework).

## D-005 · 2026-10-31 · Metrics as dated snapshots; missing is never zero

**Decision:** every reading is a row in `creator_metric_snapshots` with metric, period kind (`instant`, `day`, `week`, `lifetime`), period, the day it applies to, value, availability, retrieval time, endpoint and API version. A CHECK constraint makes `value` NULL exactly when the reading is not `available`. Growth is computed only from stored daily follower readings (`growthOver`), so it appears once history exists; it is never estimated. Combined figures use the registry: followers, posts, views and interactions may be added and are labelled "platform-reported total"; reach and accounts engaged never are. Reads happen when the dashboard opens (at most every 15 minutes, after the response), on "Refresh numbers", and hourly for up to 3 channels not read in 20 hours (Netlify scheduled function).
**Why:** directive §6 M1.4: source, definition, period, retrieval time and availability on every metric; no unique-reach claims; missing shown as unavailable. Instagram keeps account insights for a limited window, so daily snapshots build the history.
**Revisit if:** many creators connect (move the daily snapshot to a background function or worker with a larger batch).

## D-006 · 2026-10-31 · Adults only in this version

**Decision:** onboarding requires an attestation that the creator is 18 or older (stored with who attested and when; a NOT NULL column). There is no minors' flow.
**Why:** directive §8.12 requires verified guardians and legal review for under-18 creators; neither exists yet.
**Revisit when:** counsel has reviewed a guardian flow.

## D-007 · 2026-10-31 · Public media kit at /@handle; privacy-preserving visit counts

**Decision:** `/@handle` (a Next rewrite to `/p/[handle]`) is server-rendered with canonical URL, Open Graph image, JSON-LD (`ProfilePage` / `Person`), sitemap and a QR code generated in-app (`qrcode`, MIT). It shows only what the creator chose; private fields are never selected. Partnerships are labelled self-reported. Featured posts are link cards to the platform (official Instagram embeds need Meta's oEmbed approval). Visits are counted by a script beacon, once per visitor per day, as an HMAC of address, browser and day with `GENCUT_VISIT_SECRET`; the address and browser string are never stored; known crawlers are skipped. Inquiries store the exact consent text and version (`consents`), are limited to 5 per sender and 200 per profile per day, and have a honeypot. Privacy, terms and data-deletion pages are engineering drafts marked "under legal review" until counsel approves them.
**Why:** directive §6 M1.3 and §8; Meta App Review needs privacy, terms and a data-deletion callback.

## D-008 · 2026-10-31 · Read-only assistant; the model routes, it never answers

**Decision:** the web assistant answers seven read-only questions (week, top content, followers, connections, profile link, inquiries, help) from stored records with source and date. A deterministic parser runs first; if `ANTHROPIC_API_KEY` is set, the fast model may choose one of those commands (JSON only), and every call is logged in `model_runs`. Answers are built from records, so they cannot contain a number GenCut did not read. WhatsApp is not connected in this app yet.
**Why:** directive M1.5 and "do not fabricate analytics".

## D-009 · 2026-10-31 · GenCut Famous: royal purple, translucent grids, a social-app shape

**Decision (Paul, 31 Oct):** the product is named GenCut Famous and lives in `Gencut-AI/Gencut-Famous-`. It has its own identity: royal purple `#5B2BE0` for actions, deep violet `#3A1A9E`, aubergine ink `#1B1035`, lavender haze `#F3EFFF` page, frosted-glass surfaces over a faint fixed violet grid, hot pink `#FF4F9A` only for live moments (a published kit, unread inquiries). One typeface, Bricolage Grotesque (self-hosted, optical sizes), sentence case. The layout borrows the shape of a social app — a left rail on desktop and an icon tab bar on phones, channel rings on Home, a profile header with a stats row and square post tiles on the media kit — without copying any platform's design: rings are solid purple, the mark and icons are drawn for GenCut.
**Why:** Paul asked for a sleeker, social-app feel. Imitating Instagram's interface would risk confusion with Meta's product and Meta's App Review, which the Instagram connection depends on.
**Revisit if:** a brand designer delivers a fuller identity.

## D-010 · 2026-11-01 · Referral links for the first influencer partner

**Decision (Paul, 1 Nov):** GenCut's first customer is an influencer who will post a referral link on social media and bring in about 100 leads. Every creator gets a join link, `/join/<code>`, where the code is their handle at sign-up and never changes, so posted links survive a handle change. The join page says who invited the visitor and offers two paths: **Create my free account** (the code rides in an HttpOnly cookie for 30 days and the new workspace is credited to the referrer; self-referral is ignored) or **Keep me posted** (name, email, optional handle, role, and consent stored with its exact text). Visits are counted once per visitor per day with the same one-way hash as media-kit visits; tagged links (`?src=instagram`) show which post works. The referrer's **Referrals** page shows visits, leads, sign-ups and join rate; it shows lead names and handles but never emails, as the consent text promises. GenCut staff (emails in `GENCUT_ADMIN_EMAILS`) see every lead with its email at `/admin/referrals` to follow up.
**Not built:** payouts or commissions (a business agreement, not app logic), notifications when a lead arrives, follow-up emails.
**Why:** the partner needs to show results to others; leads that are not ready to sign up are still worth keeping, with consent.

## D-011 · 2026-11-01 · Sign-in email carries a device-independent link and a code

**Decision:** the Supabase "Magic Link" and "Confirm signup" templates link to `/auth/confirm` with a `token_hash` (verified with `verifyOtp`, works in any browser) instead of the default PKCE link, and also show the one-time code. The "check your inbox" screen has a code box (`verifySignInCode`), so someone who reads the email on a phone can sign in on a laptop. The PKCE `code` path stays supported in `/auth/confirm` for any old emails.
**Why:** the first outside sign-up (1 Nov) failed: the link was requested in one browser and opened from Gmail in another (Edge), so the PKCE verifier cookie was missing. Referral visitors will often hit the same split (social app in-app browser vs. mail app).
**Risk:** a mail scanner that opens links can use up a token-hash link; the code still works then.

## D-012 Pasted social links on the media kit (13 Nov 2026)

**Context:** The first creator needs their media kit to link to their profiles on every platform, but links came only from accounts connected through each platform's sign-in, and none can connect until the Meta app is approved; the other platforms are on the roadmap.

**Decision:** Creators paste their profile links (one per line) on the Media kit page. `packages/core` reads each link, works out the platform, stores a canonical https URL, and refuses posts, share links and bare @names with a hint. They are stored on `creator_profiles.social_links` (migration 0006, at most 10, kinds checked by the database) and shown as buttons on the media kit. They are links only: no figures come from them, so rule 3 (never fabricate) is unaffected. An account connected through the platform's sign-in comes first and replaces a pasted link to the same profile.

**Also:** link previews now resolve against the deployment address (`metadataBase` from `GENCUT_PUBLIC_URL`, else the build-time site URL), so links shared on social apps show their preview card; invite links get their own preview image. Brand images are shrunk in the browser to about 1.5 MB before upload, because phone photos exceed the hosting request limit.

## D-013 Instagram through Meta's Unified Login (13 Nov 2026)

**Context:** Creating GenCut's Meta app on 13 Nov, the dashboard said "API setup with Instagram login is not available for newer apps"; only "API setup with Unified login" (and the Facebook-login setup, which needs a Facebook Page) are offered. The Instagram connector was built for Instagram Login.

**Decision:** Add a second client behind the same `InstagramApi` interface, `UnifiedInstagramApi`, used when `INSTAGRAM_CONFIG_ID` is set; the Instagram Login client stays for apps that still have it. Sync, storage, metrics and states are unchanged. Permission checks treat `instagram_basic`/`instagram_manage_insights` as the same permissions as `instagram_business_basic`/`instagram_business_manage_insights`; stored grants keep Meta's own names. The Instagram account id comes from `debug_token`'s `granular_scopes`, because Meta's newer endpoints for this setup are not fully documented; the first live connection is the check.


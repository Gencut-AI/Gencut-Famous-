# Product status

Status labels follow the directive (§14): LIVE · IMPLEMENTED BUT NOT YET VERIFIED · PROTOTYPE · BLOCKED · IN DEVELOPMENT · ROADMAP. Deployed at gencutfamous.netlify.app since 1 Nov 2026; rows say what has been checked live (last review 19 Nov 2026).

| Capability | Status | Notes |
| --- | --- | --- |
| Sign-in (email link and code; Continue with Google behind `GENCUT_GOOGLE_SIGNIN`), onboarding (name, handle, 18+ attestation) | LIVE (email) · IMPLEMENTED BUT NOT YET VERIFIED (Google) | Email sign-up from an outside Gmail verified 1 Nov; code entry 13 Nov. Two outside sign-ups stalled at the email step (D-014). Google needs the provider set up (docs/deployment.md). |
| Brand profile (identity, audience, voice, visual, goals, partnerships, rate card), images | IMPLEMENTED BUT NOT YET VERIFIED | All optional except name and handle. |
| Managers (invite link, role limits, creator switcher) | IMPLEMENTED BUT NOT YET VERIFIED | |
| Instagram connection (Unified Login, encrypted tokens, 7 states, disconnect, delete data) | LIVE | @gencutai connected 13 Nov as a tester; synced daily since with no errors (checked 19 Nov). Other accounts need Meta App Review or the tester list. |
| Metrics sync and dashboard (followers, growth, reach, views, engagement, top content) | LIVE | 11 Instagram metrics stored as available for 7 days, 15 posts (checked 19 Nov). |
| Meta deauthorize and data-deletion callbacks | IMPLEMENTED BUT NOT YET VERIFIED | URLs to register in the Meta app. |
| Pasted social links (Instagram, TikTok, YouTube, X, Threads, Facebook, LinkedIn, website) on the media kit | IMPLEMENTED BUT NOT YET VERIFIED | Pasted on Media kit → Your social links; platform read from the link; posts and share links refused with a hint. Links only, no numbers; a connected account replaces a pasted link to the same profile. Rendered locally at 390 px. |
| Public media kit `/@handle`, SEO, QR, tagged links, visit counts | LIVE | @neo published 13 Nov; inquiries arrived through it (one from the QR code). Domain not attached. |
| Inquiries with stored consent; email to the creator's team for each new one (reply-to the sender) | LIVE | Inquiries received 13 Nov; the alert email was sent and audited. |
| Referral links: join page, visit and lead tracking, sign-up credit, Referrals dashboard, staff lead list | LIVE (join page, visits, dashboard) · NOT YET VERIFIED (lead form, sign-up credit) | /join/neo and its visits checked live 1 and 13 Nov; no real lead or referred sign-up yet. |
| Staff sign-up list `/admin/signups`: who is set up, who signed in without a profile, who never finished sign-in | IMPLEMENTED BUT NOT YET VERIFIED | Tested in services. Reads Supabase `auth.users` when the database role may; otherwise says sign-in records are unavailable. Needs `GENCUT_ADMIN_EMAILS`. |
| Assistant on the web (read-only) | IMPLEMENTED BUT NOT YET VERIFIED | |
| Privacy, terms, data deletion pages | PROTOTYPE | Engineering drafts; counsel review needed. |
| Assistant over WhatsApp | ROADMAP | Needs this app's own WhatsApp number or a shared service. |
| YouTube, TikTok, Threads, Facebook, LinkedIn connectors | ROADMAP | Listed on Channels as "Roadmap". |
| X connector | ROADMAP | Deferred: paid per call. |
| Audience demographics | ROADMAP | Instagram returns them only above 100 followers. |
| Content adaptation and distribution (M2), Film Crew (M3), Brand Deal Radar (M4), Pitch and negotiation (M5) | ROADMAP | |
| Deal pipeline, earnings | ROADMAP | Dashboard says "Not set up yet". |

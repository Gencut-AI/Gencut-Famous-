# Product status

Status labels follow the directive (§14): LIVE · IMPLEMENTED BUT NOT YET VERIFIED · PROTOTYPE · BLOCKED · IN DEVELOPMENT · ROADMAP. Deployed at gencutfamous.netlify.app since 1 Nov 2026; rows say what has been checked live.

| Capability | Status | Notes |
| --- | --- | --- |
| Sign-in (email link), onboarding (name, handle, 18+ attestation) | IMPLEMENTED BUT NOT YET VERIFIED | Tested in services and rendered locally; Supabase Auth not yet configured for this project. |
| Brand profile (identity, audience, voice, visual, goals, partnerships, rate card), images | IMPLEMENTED BUT NOT YET VERIFIED | All optional except name and handle. |
| Managers (invite link, role limits, creator switcher) | IMPLEMENTED BUT NOT YET VERIFIED | |
| Instagram connection (OAuth, encrypted tokens, 7 states, disconnect, delete data) | IMPLEMENTED BUT NOT YET VERIFIED | Tested against a scripted fake; needs a Meta app and a tester account to verify live. |
| Metrics sync and dashboard (followers, growth, reach, views, engagement, top content) | IMPLEMENTED BUT NOT YET VERIFIED | Same. |
| Meta deauthorize and data-deletion callbacks | IMPLEMENTED BUT NOT YET VERIFIED | URLs to register in the Meta app. |
| Pasted social links (Instagram, TikTok, YouTube, X, Threads, Facebook, LinkedIn, website) on the media kit | IMPLEMENTED BUT NOT YET VERIFIED | Pasted on Media kit → Your social links; platform read from the link; posts and share links refused with a hint. Links only, no numbers; a connected account replaces a pasted link to the same profile. Rendered locally at 390 px. |
| Public media kit `/@handle`, SEO, QR, tagged links, visit counts | IMPLEMENTED BUT NOT YET VERIFIED | Rendered locally at 390 and 1440 px. Domain not attached. |
| Inquiries with stored consent; email to the creator's team for each new one (reply-to the sender) | IMPLEMENTED BUT NOT YET VERIFIED | Email needs `RESEND_API_KEY` and `GENCUT_EMAIL_FROM`; `/api/health` shows `inquiryEmail: on/off`. Send outcome audited (count only). |
| Referral links: join page, visit and lead tracking, sign-up credit, Referrals dashboard, staff lead list | IMPLEMENTED BUT NOT YET VERIFIED | Tested in services and rendered at 390 and 1440 px; staff page needs `GENCUT_ADMIN_EMAILS`. |
| Staff sign-up list `/admin/signups`: who is set up, who signed in without a profile, who never finished sign-in | IMPLEMENTED BUT NOT YET VERIFIED | Tested in services. Reads Supabase `auth.users` when the database role may; otherwise says sign-in records are unavailable. Needs `GENCUT_ADMIN_EMAILS`. |
| Assistant on the web (read-only) | IMPLEMENTED BUT NOT YET VERIFIED | |
| Privacy, terms, data deletion pages | PROTOTYPE | Engineering drafts; counsel review needed. |
| Assistant over WhatsApp | ROADMAP | Needs this app's own WhatsApp number or a shared service. |
| YouTube, TikTok, Threads, Facebook, LinkedIn connectors | ROADMAP | Listed on Channels as "Roadmap". |
| X connector | ROADMAP | Deferred: paid per call. |
| Audience demographics | ROADMAP | Instagram returns them only above 100 followers. |
| Content adaptation and distribution (M2), Film Crew (M3), Brand Deal Radar (M4), Pitch and negotiation (M5) | ROADMAP | |
| Deal pipeline, earnings | ROADMAP | Dashboard says "Not set up yet". |

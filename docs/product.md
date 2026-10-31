# Product status

Status labels follow the directive (§14): LIVE · IMPLEMENTED BUT NOT YET VERIFIED · PROTOTYPE · BLOCKED · IN DEVELOPMENT · ROADMAP. As of 31 Oct 2026 nothing is deployed, so nothing is LIVE.

| Capability | Status | Notes |
| --- | --- | --- |
| Sign-in (email link), onboarding (name, handle, 18+ attestation) | IMPLEMENTED BUT NOT YET VERIFIED | Tested in services and rendered locally; Supabase Auth not yet configured for this project. |
| Brand profile (identity, audience, voice, visual, goals, partnerships, rate card), images | IMPLEMENTED BUT NOT YET VERIFIED | All optional except name and handle. |
| Managers (invite link, role limits, creator switcher) | IMPLEMENTED BUT NOT YET VERIFIED | |
| Instagram connection (OAuth, encrypted tokens, 7 states, disconnect, delete data) | IMPLEMENTED BUT NOT YET VERIFIED | Tested against a scripted fake; needs a Meta app and a tester account to verify live. |
| Metrics sync and dashboard (followers, growth, reach, views, engagement, top content) | IMPLEMENTED BUT NOT YET VERIFIED | Same. |
| Meta deauthorize and data-deletion callbacks | IMPLEMENTED BUT NOT YET VERIFIED | URLs to register in the Meta app. |
| Public media kit `/@handle`, SEO, QR, tagged links, visit counts | IMPLEMENTED BUT NOT YET VERIFIED | Rendered locally at 390 and 1440 px. Domain not attached. |
| Inquiries with stored consent | IMPLEMENTED BUT NOT YET VERIFIED | GenCut does not email the creator about new inquiries yet. |
| Assistant on the web (read-only) | IMPLEMENTED BUT NOT YET VERIFIED | |
| Privacy, terms, data deletion pages | PROTOTYPE | Engineering drafts; counsel review needed. |
| Assistant over WhatsApp | ROADMAP | Needs this app's own WhatsApp number or a shared service. |
| YouTube, TikTok, Threads, Facebook, LinkedIn connectors | ROADMAP | Listed on Channels as "Roadmap". |
| X connector | ROADMAP | Deferred: paid per call. |
| Audience demographics | ROADMAP | Instagram returns them only above 100 followers. |
| Content adaptation and distribution (M2), Film Crew (M3), Brand Deal Radar (M4), Pitch and negotiation (M5) | ROADMAP | |
| Deal pipeline, earnings | ROADMAP | Dashboard says "Not set up yet". |

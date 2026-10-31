# Architecture

One TypeScript monorepo, one Postgres database (Supabase project "GenCut Creators"), one Next.js deployment on Netlify.

```
 Signed-in app (Next.js PWA)        Public media kit /@handle       Meta callbacks
 app/(app)/*                        app/p/[handle] (SSR, OG, JSON-LD) app/api/meta/*
          \                               |                           /
           v                              v                          v
     packages/services — use cases: membership + capability check, audit, transactions
           |                     |                         |
           v                     v                         v
     packages/core (pure rules)  connectors/ (Instagram API, TokenCipher, OAuth state)
           |
           v
     Postgres (RLS closed to the public API; server connects directly)
           ^
           |  hourly daily-snapshot function (functions-src/creator-daily-sync.mts)
```

- **Sign-in:** Supabase email links; `getClaims()` verifies the token on every request; the app keeps its own `users`, `workspaces`, `memberships`.
- **Authorization:** services only. `requireCapability(db, ctx, workspaceId, capability)` before every read or write.
- **Connectors:** a manifest per platform in `core/connectors` declares OAuth, scopes, account types, analytics, publishing, tokens, revocation, rate limits, approval and unsupported features. Only Instagram is built.
- **Background work:** reads run after the dashboard response (`after()`), on demand, and from an hourly Netlify scheduled function (3 channels per run).
- **Models:** ModelRouter by role; only the assistant's question routing uses it.

See `decisions.md` for why.

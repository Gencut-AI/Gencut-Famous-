# AGENTS.md — working in the GenCut Famous repository

Instructions for AI coding agents and human contributors. Keep this file accurate; update it in the same pull request as any change it describes.

## What this is

GenCut Famous: brand profile → connected accounts → verified metrics → public media kit → inquiries, with a read-only assistant. A separate codebase from GenCut Properties (D-001) that copies its proven foundations; its look is its own (D-009: royal purple, glass over a faint grid, Bricolage Grotesque). The product directive is the "GenCut for Creators — Master Development Directive" (now named GenCut Famous); status by feature is in `docs/product.md`.

## Layout

| Path | Contents |
| --- | --- |
| `packages/core` | Pure rules: roles, handles, profile sections, metric registry, connector manifests and connection states, Instagram response parsing, assistant parser. No I/O, no npm dependencies. |
| `packages/db` | SQL migrations (`migrations/NNNN_name.{up,down}.sql`), the psql runner, schema tests. |
| `packages/services` | Database-backed use cases with authorization (`requireCapability`) and audit. `connectors/` is the only code that decrypts a token. |
| `apps/web` | Next.js 16 PWA on Netlify: signed-in app under `app/(app)`, public media kit at `/@handle` (rewritten to `app/p/[handle]`), OAuth and Meta callback routes under `app/api`. Scheduled functions in `functions-src/`, bundled at build. |
| `docs/` | Architecture, product status, data model, integrations, environment, deployment, decisions. |

## Commands

```bash
scripts/dev-db.sh start          # local Postgres (PG_RUN_AS=<user> when root); export the URL it prints
export TEST_DATABASE_URL=postgres://postgres@localhost:<port>/postgres   # TCP URL also works
pnpm lint && pnpm typecheck && pnpm test   # = pnpm check; must pass before every commit
pnpm build                                # web build (also bundles Netlify functions)
DATABASE_URL=... pnpm db:migrate          # apply pending migrations
```

TypeScript runs directly on Node ≥ 22.18: import local files with `.ts`; erasable syntax only (no `enum`, `namespace`, parameter properties).

## Rules that are not negotiable

1. **Business logic lives in `packages/core` and `packages/services`.** Pages and routes call services; never re-implement a rule in a component.
2. **Every service checks membership and capability** (`requireCapability`: owner vs manager, `packages/core/src/roles.ts`). The database is closed to Supabase's public API (RLS on, no policies); the frontend is never the security boundary.
3. **Never fabricate.** No invented metrics, estimates, growth or partnerships. Missing data is stored as `unavailable` with a NULL value (a CHECK constraint enforces it) and shown as unavailable, never zero. Every figure carries source, period and retrieval time.
4. **Never add reach or engaged accounts across platforms.** Combined figures come only from `combineAcrossPlatforms` and are labelled platform-reported totals.
5. **Official APIs only.** No scraping, no unofficial clients, no posting in this version. OAuth success is not proof of capability: the connection state comes from granted scopes and the manifest.
6. **Tokens**: AES-256-GCM via `TokenCipher`, bound to the channel id; never sent to the browser, logged, or put in audit detail or error messages.
7. **Public pages show only what the creator chose.** Rate card, legal name, brands avoided, goals and audience notes are never selected by `getPublishedProfile`. Partnerships are always labelled self-reported.
8. **Models by configuration** through the ModelRouter; `pnpm lint` rejects model names in `packages/core`. The model may route a question; it never writes an answer.
9. **Secrets** only in platform secret stores; `.env.example` holds names, never values.
10. **Adults only** in this version (D-006).

## Changing the schema

Add a numbered pair `NNNN_name.up.sql` / `.down.sql`; never edit an applied migration. If you add a role, platform, metric, availability, niche or inquiry kind, change `packages/core` and the CHECK constraint together — `packages/db/test/schema.test.ts` fails if they drift. Production: apply with `pnpm db:migrate` against the GenCut Creators project.

## Git

Branch per slice: `c<milestone>/<topic>` (e.g. `c1/youtube`). `main` is protected; merge by pull request with green CI. Imperative commit subjects ≤ 72 characters. Never claim something works without the command output that shows it.

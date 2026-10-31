# Development

Requirements: Node ≥ 22.18, pnpm 10, PostgreSQL 16 binaries (or Docker).

```bash
pnpm install
scripts/dev-db.sh start          # prints TEST_DATABASE_URL; as root set PG_RUN_AS=<user>
export TEST_DATABASE_URL=...
pnpm check                       # lint + typecheck + all tests
pnpm build
```

| Suite | Where | Needs |
| --- | --- | --- |
| Domain | `packages/core/test` | nothing |
| Schema and migrations | `packages/db/test` | `TEST_DATABASE_URL` |
| Services (accounts, profile, Instagram connect and sync with a scripted fake, public profile, inquiries, assistant) | `packages/services/test` | `TEST_DATABASE_URL` |
| Web helpers and function bundle | `apps/web/test` | nothing |

External APIs are never called in tests: `FakeInstagram` in `packages/services/test/helpers.ts` scripts Instagram's answers. Live behaviour is verified separately with a tester account (`docs/integrations.md`).

Coming: Playwright end-to-end at 390 px and 1440 px in CI.

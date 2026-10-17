# GoToMenu

QR table ordering for cafes and restaurants. Guests scan, order and call the waiter from their phone; staff see
live orders on one screen. No online payments: the table is marked paid by staff.

Status: **Phase 1 (foundation + database) complete.** See `docs/PLAN.md` for the full plan.

## Commands
| Command | What it does |
|---|---|
| `npm run lint` | Lint; any warning fails |
| `npm run typecheck` | Strict TypeScript check |
| `npm test` | Unit tests |
| `npm run test:sql` | Database tests against a real local Postgres (needs `TEST_DATABASE_URL`, see below) |
| `npm run check:rls` | Fails if any table lacks Row Level Security, or `anon` has table access |
| `npm run check:secret-scan` | Fails if anything in the repo looks like a real secret |
| `npm run audit` | Dependency audit gate |
| `npm run build` | Production build (fails on invalid environment settings) |
| `npm run check:secrets` | After a build: proves server secrets are not in browser files |
| `npm run test:http` | Starts the built app and asserts the security headers on real responses |

SQL tests need a Postgres 16 superuser. Default: `postgres://gm_test:gm_test@127.0.0.1:5432/postgres`
(override with `TEST_DATABASE_URL`). Each test file creates its own throw-away database, applies every file in
`supabase/migrations/`, and drops it afterwards.

## Layout
- `supabase/migrations/` numbered SQL migrations (the database is the source of truth for security)
- `supabase/tests/` SQL test suite; `helpers/supabase_stub.sql` imitates the parts of Supabase we rely on
- `src/` Next.js app; `scripts/` CI checks; `docs/` plan, dependencies, (later) threat model, runbook, deployment

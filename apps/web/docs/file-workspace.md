# File workspace

The protected `/projects/[projectId]/files` route contains a persistent chat and a Claude-inspired editable artifact panel with scoped warm neutrals, Preview/Edit, historical version navigation, and mobile Chat/Artifact tabs. Files belong to the existing Supabase project/workspace permission model. The project list links to the workspace when enabled. DeepSeek powers generation; the conversion worker processes import/export jobs.

## Enable locally

1. Install locked dependencies with `npm ci`.
2. Start the existing local Supabase stack and run its existing setup (`npm run db:setup`).
3. Run `npm run files:setup` to add file tables, read policies, and the private `project-files` bucket. This additive SQL bootstrap is idempotent and does not modify existing projects.
4. Add `FILE_WORKSPACE_ENABLED=true`, `DEEPSEEK_API_KEY`, and optional `DEEPSEEK_MODEL=deepseek-flash` to `.env.local`. The key is server-only. The feature defaults off.
5. Configure and start the worker with `docker compose -f workers/files/compose.yaml up --build -d`. For local services, supply container-reachable database/storage URLs in a private worker environment file; see the worker README. Then set `FILE_WORKER_ENABLED=true` in the app.
6. Run `npm run dev`, sign in, open Projects, and select a project. Restart Next after environment changes.

Creation/editing works without the AI key; chat explains the missing connection. Imports/exports remain disabled until the worker flag is enabled. No other AI provider connection or user API-key vault is implemented yet; the server-side provider interface supports future adapters.

## Data and behavior

`workspace_files` holds metadata and the current revision pointer. `file_revisions` holds immutable snapshots. `file_messages` persists project chat. `file_jobs` persists generation, import, and export state, duration, and AI token usage. Server generation runs using Next's `after()`; interrupted generation is marked failed after five minutes and can be retried. Workers claim only import/export jobs with row locks and reclaim abandoned executions.

Every API action validates a verified Supabase user and active workspace membership. Viewers can read; members/admins/owners can write. Browser table writes are denied. Private original/export downloads use five-minute signed URLs; imported images use an authenticated same-origin proxy. Saving and generation compare the source revision under a database lock. Concurrent work is preserved as an alternative revision; it never silently replaces the current file. Copying files also copies private image assets.

Uploads: DOCX, PPTX, XLSX, CSV, PDF; 20 MB maximum. PDF text becomes an editable document while the original remains viewable. Scanned/encrypted PDFs require OCR/an unlocked copy. Complex layouts can change; conversion warnings remain attached to the file. Office external relationships, macros, embedded objects, malicious archives/XML, and scripted PDFs are rejected. Formula support and conversion limits are documented in `workers/files/README.md`.

## Verification record — 2026-11-04

- Production webpack build passed, including Next TypeScript validation and route generation.
- App unit suite excluding unavailable legacy Supabase integration suites: 644 passed. New access/provider/content/formula tests are included.
- Seven PostgreSQL integration checks passed against an isolated local test database: reopen/duplicate/rename/delete, concurrency, restore, access isolation, revoked permissions, image ownership, and durable jobs.
- Ten browser editor tests use real React/Tiptap with a mocked API. They verify editing, autosave/reopen/errors/conflicts/restores, file management, generation alternatives, export, keyboard/mobile behavior. These are not live-provider acceptance tests.
- Worker fixture suite passed, reopening generated DOCX/PPTX/XLSX in independent readers; includes import security, formulas, images, PDF extraction, and subprocess cleanup.
- Full `npm test` also attempts four pre-existing integration suites against local Supabase at port54322. Those cannot run while that stack is stopped. The new database checks use a separate explicit `FILE_TEST_DATABASE_URL`.
- ESLint retains the existing unused `_source` warning in `src/lib/env.ts`.

Live DeepSeek requests, live Supabase Storage, the Docker container, and actual LibreOffice PDF rendering have not been exercised here: no DeepSeek key/running local Supabase/Docker daemon was available. Keep the feature flag off until those acceptance checks pass. The existing Next16.3 and other baseline runtime dependencies have npm audit advisories; this change does not upgrade the framework. The new PPTX dependency is pinned4.0.0, with image-size overridden to patched2.0.3. The separate converter dependency lockfile audited with zero vulnerabilities.

## Tests

```sh
npm run typecheck
npm run lint
npm test -- --exclude 'src/lib/server/stores/*.integration.test.ts'
# Requires a dedicated disposable PostgreSQL database, never a production database:
FILE_TEST_DATABASE_URL=postgres://user@127.0.0.1:55439/testdb npm test -- --run src/lib/server/files/store.integration.test.ts
npm run test:files:e2e
npm run build -- --webpack
```

The isolated PostgreSQL suite creates its own minimal auth/storage fixtures and roles in that dedicated database. Browser tests use Playwright Chromium or `FILES_E2E_CHROME` for an installed Chrome executable. Worker commands are in its README.

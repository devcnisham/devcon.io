# DevCon file conversion worker

This service claims persisted `import` and `export` jobs from PostgreSQL. AI generation stays in the Next.js app. Run the app's file schema/storage setup before starting it.

From the application root, install the locked JavaScript dependencies and start:

```sh
npm ci
npm run files:setup
docker compose -f workers/files/compose.yaml up --build -d
```

The environment file must contain `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. Use database/storage addresses reachable **from inside the container**. For a local Supabase stack replace localhost with `host.docker.internal` in a worker-specific environment file and adjust `env_file`; keep service credentials private. Set `FILE_WORKER_ENABLED=true` in the app only while the worker is running.

The worker uses PostgreSQL `FOR UPDATE SKIP LOCKED` so multiple instances do not claim the same job. A process that crashes is reclaimed after five minutes, with three executions maximum. Deterministic conversion failures remain failed until the user retries. Originals, imported images, and exports stay in the private `project-files` bucket. Export paths include the immutable revision ID. Imported images use authenticated app proxy URLs and are never public.

DOCX is rendered with python-docx. PPTX uses PptxGenJS. XLSX uses SheetJS, with supported bold/number formatting applied by openpyxl. PDF exports are made by LibreOffice from these newly generated files; uploaded binaries are never opened by LibreOffice. Its macro security is locked, links are not updated, and a seccomp child process blocks IPv4/IPv6 sockets. The container runs without capabilities, with a read-only filesystem, bounded RAM/CPU/process count, and temporary working space.

Import supports text, basic headings/lists/tables/images, slide text and first image positioning, spreadsheet values/basic formatting/supported formulas, and PDF text extraction. Complex formatting can change and warnings are persisted. Scanned and encrypted PDFs fail with OCR/unlock guidance. Uploaded Office files with macros, embedded objects, external relationships, unsafe XML, path traversal, or excessive expansion are rejected. PDFs containing embedded scripts, file attachments, or automatic actions are rejected. CSV downloads neutralize formula injection.

Limits: uploads 20 MB; ZIP expansion 100 MB / 10,000 entries; workbook 20 sheets, 2,000 rows per sheet, 100 columns, 100,000 total cells; presentations 100 slides; PDFs 500 pages; images 40 million pixels and 10 MB normalized; conversions 150 seconds; each LibreOffice/Node invocation 90 seconds; exports 20 MB.

Test without PostgreSQL or credentials:

```sh
python3 -m venv /tmp/devcon-files-worker
/tmp/devcon-files-worker/bin/pip install -r workers/files/requirements.txt pytest
cd workers/files
/tmp/devcon-files-worker/bin/python -m pytest -q
```

Optional integration checks require a running local database/storage stack and a built container. Verify the worker's `file-worker-ready` event, queue a DOCX/PPTX/XLSX/PDF export through the app, wait for `succeeded`, download the exact revision, and open it in Office/LibreOffice and a PDF reader. Logs contain IDs, operation kind, duration, and exception class only; document text, filenames, request bodies, signed URLs, and secrets are excluded.

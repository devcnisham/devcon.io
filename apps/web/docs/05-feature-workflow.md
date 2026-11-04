# 05 — Feature Workflow

## Every feature passes through 18 steps, in order

```
01 Requirement       →  what problem, for whom, why now
02 User flow         →  the path a developer takes through it
03 UI/UX             →  screens, states, empty/loading/error
04 Database          →  tables, relations, RLS
05 Backend/API       →  server actions, route handlers
06 Business logic    →  the rules, isolated and testable
07 Frontend          →  components wired to the API
08 Validation        →  Zod at every boundary
09 Error handling    →  failure paths, user-visible messages
10 Tests             →  Vitest unit/integration, Playwright e2e
11 Documentation     →  what it does, how to extend it
12 Integration       →  wired into the rest of the product
13 CI                →  passing in the pipeline
14 Preview           →  deployed preview verified
15 QA                →  walked manually against the requirement
16 Deploy            →  in production
17 Monitor           →  errors and health visible
18 DONE
```

**Do not open a component file before steps 01–05 are settled.** Do not mark
anything DONE before tests, documentation, and monitoring exist for it.

Why this order: the product exists to teach new developers the professional
end-to-end process. Building it any other way contradicts its own thesis.

**Write the test before the code**, and watch it fail. A test written after the
fact passes immediately, which proves nothing — it verifies what you built, not
what was required. This is not theoretical here: of the eight defects in
[bug.md](bug.md), the most serious one produced no error, no warning, and no
failing build. Only a test asserting the control engaged found it.

Every defect found along the way goes in [bug.md](bug.md), including ones
introduced and fixed within the same session.

## The complete development pipeline

This is the pipeline devstep walks a developer through — and the one devstep
itself follows.

```
        IDEA
          ↓
    REQUIREMENTS
          ↓
        PRD
          ↓
    USER FLOWS
          ↓
    ARCHITECTURE
          ↓
      UI / UX
          ↓
     DATABASE
          ↓
   BACKEND / API
          ↓
      FRONTEND
          ↓
    INTEGRATIONS
          ↓
        GIT
          ↓
      TESTING
          ↓
       CI/CD
          ↓
      PREVIEW
          ↓
         QA
          ↓
  PRODUCTION READY
          ↓
     DEPLOYMENT
          ↓
     MONITORING
          ↓
      RELEASE
          ↓
    MAINTENANCE
          ↓
    NEXT FEATURE
```

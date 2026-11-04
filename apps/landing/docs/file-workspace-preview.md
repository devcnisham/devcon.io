# File workspace landing-page preview

Implemented 2026-11-04 as an addition to the existing immersive landing page.

The Files preview section demonstrates Documents, Slides, Sheets, and PDFs in a conversation-and-preview layout. Each example has independent local draft/revised state, a sample revision request, version labels, and a working download. Arrow keys, Home, and End move through tabs, with matching tab-panel labels and a polite status region.

## Honest sample formats

| Example | Download | Sample revision |
| --- | --- | --- |
| Documents | Markdown `.md` | Adds a measurable success target |
| Slides | Standalone HTML `.html` | Revises the opening benefit |
| Sheets | CSV `.csv` | Adds $30 testing cost and updates total to $62 |
| PDFs | Real one-page PDF `.pdf` | Adds a release recovery check |

The page labels the showcase **Feature preview**, **Local example**, and **Illustrative demo**. It makes no AI requests, accepts no uploads, and stores no user data. Full editors and Office exports are described as in development rather than live. The existing app/docs destinations are unchanged.

## Files

- `dist/index.html`: section and navigation entry, with static fallback preview.
- `dist/files-demo.css`: scoped responsive structure, keyboard focus, and reduced-motion rules.
- `dist/artifact-preview.css`: final styling for the file preview only: warm `#faf9f5`/`#f5f4ed` surfaces, charcoal text, terracotta accent, serif file headings, and sans UI. Chat remains on the left and the artifact on the right on desktop; panels stack on mobile.
- `dist/files-demo.js`: independent file tabs, sample generation/revision states, and local Blob downloads. The PDF generator writes real objects, a content stream, and byte-accurate cross-reference offsets.
- `dist/studio.js`: scopes original project tabs to `[data-project]` so the two demonstrations remain independent.

## Verification

- `node --check dist/files-demo.js` and `node --check dist/studio.js`: passed.
- Headless Chrome at 1440 × 1000 and 390 × 844: all four examples load, revise, and download with the correct extensions and revised content.
- File tab state persists when switching examples; keyboard Arrow/Home/End navigation maintains selected state and focus.
- Original university-project tab still changes its plan without changing the selected file example.
- Axe accessibility scan of the file showcase after the PDF revision: zero violations. The initial scan found text contrast issues, which were corrected before rerunning.
- 390px viewport: no page-level horizontal overflow; revised sheet total visible as $62.
- Reduced-motion browser setting: interface and actions remain usable.
- No browser page errors during the tested flows.
- Independent `pdfinfo` inspection: valid PDF 1.4, one Letter-sized page, unencrypted, no JavaScript.

Browser test harness and sample downloads were kept in `/private/tmp`; screenshots are `/private/tmp/devcon-file-showcase-desktop.png` and `/private/tmp/devcon-file-showcase-mobile.png`.

## Repository note

This machine's global Git ignore file ignores `dist/`. The working preview files exist on disk but will need an explicit `git add -f dist/index.html dist/studio.js dist/files-demo.css dist/files-demo.js` if a later task should commit these buildless source files. This task did not commit changes. Include `dist/artifact-preview.css` in any later explicit staging command.

## Design clarification

The owner clarified that the Claude reference applies to **the artifact workspace**, not the entire homepage. The neutral/terracotta treatment is confined to the Files preview. DevCon branding, the immersive hero, existing imagery, original project-plan demo, and all other landing-page sections retain their existing appearance. A temporary global theme layer was removed before handoff.

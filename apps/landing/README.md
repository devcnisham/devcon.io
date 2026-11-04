# DevCon landing page

A rebuilt landing page for the DevCon AI project agent, using the user's latest Krev reference for its immersive composition. Original imagery, centered hero, glass navigation, and a working project-plan demonstration.

## Run locally

```sh
python3 -m http.server 4187 --directory dist --bind 127.0.0.1
```

Open http://127.0.0.1:4187.

## Active files

- `dist/index.html`: content, semantic structure, and responsive artwork.
- `dist/studio.css`: shared components, project demo, and responsive layout.
- `dist/immersive.css`: current immersive visual direction for the landing page.
- `dist/studio.js`: project examples, per-step prompts, clipboard feedback, explained omissions, navigation, and motion controls.
- `dist/files-demo.css` and `dist/files-demo.js`: isolated file workspace preview with Documents, Slides, Sheets, and PDF examples, revisions, and honest sample downloads.
- `dist/artifact-preview.css`: warm neutral, terracotta-accented chat/artifact styling scoped to the file preview; the immersive homepage remains unchanged.
- `dist/assets/`: original, web-optimized artwork.

Older design files remain available but are not loaded by the current page.

The Next.js application is in `/Users/nishhaamm/Desktop/007/`. Its file workspace is implemented separately from this static landing-page preview. App and documentation actions retain their existing DevCon destinations. The illustrative demo does not call an AI service or simulate saved signup data.

See `docs/immersive-redesign.md` for the design and verification record.

The file workspace showcase is labelled **Feature preview** and **Local example**. It does not call AI, upload files, or promise a live deployment. Sample downloads use their actual formats: Markdown, HTML slide, CSV, and PDF. See `docs/file-workspace-preview.md`.

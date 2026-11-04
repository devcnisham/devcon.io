# DevCon immersive landing page

The user's latest reference is https://www.krev.ai/. The user requested different imagery related to this project, and declined the earlier portrait idea.

## Design

An immersive creative-studio environment opens the page, with a centered headline, glass navigation, a lavender primary action, and a large interactive product window. The product window introduces actual DevCon concepts: project context, an ordered plan, explained omissions, and coding prompts. Below it are the three-step workflow, an original code-to-plan illustration, focused capability cards, the rationale for shorter plans, FAQs, and a closing action.

Krev informed the composition and product-preview treatment. All branding, copy, code, and artwork are original for DevCon. No Krev assets, agent characters, testimonials, partner logos, or performance claims are used.

## Artwork

- `dist/assets/devcon-world.jpg`: original generated creative workspace and garden, used decoratively behind the hero.
- `dist/assets/devcon-workflow.jpg`: original generated developer workstation connected to project cards and a path forward, with descriptive alt text.

Generated PNG originals remain in the image-generation directory; working copies were encoded to JPEG for the web. The hero is approximately 695 KB; the secondary image is approximately 220 KB and lazy-loaded. No portrait is used.

## Implementation

`dist/index.html`, `dist/studio.css`, `dist/immersive.css`, and `dist/studio.js` are the active page. Older design files are retained but are not loaded. Buildless HTML/CSS/JS. Existing Vercel app and docs links are preserved. The app folder `/Users/nishhaamm/Desktop/007/` supplied product context and has not been modified.

## Verification

- `node --check dist/studio.js`.
- Desktop browser: both images load; no document horizontal overflow; switching to a university project updates the stack, goal, plan, and prompts; prompt copying confirms success; omitted steps expose reasons.
- 390px iframe viewport: hero visual inspection, mobile menu opening/closing, context switching, and prompt expansion while motion is paused.
- Reduced-motion styles and preference handling implemented; operating-system preference toggling was not exercised.

Demo plans are local illustrative data, not live AI results. This work completes the landing-page redesign and does not implement the broader agent application.

## Capability-card motion

Construct Computer's second capability card informed an original context-flow diagram: floating project tiles, curved dashed routes, traveling signals, and a gently pulsing plan destination. The focus and coding-prompt cards also have coordinated motion. Styles live in `dist/card-motion.css`; no dependency was added. Existing file-workspace content is preserved.

The shared pause controls stop motion; diagrams pause offscreen and when the document is hidden, and honor reduced-motion preferences. Checked JavaScript syntax, desktop layout without horizontal overflow, computed paused animation states, resume control state, and the 390px mobile card layout. OS reduced-motion toggling was not tested.

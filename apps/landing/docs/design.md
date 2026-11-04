# DevCon landing page redesign

## Purpose
Position DevCon as an AI agent for developers taking an idea or existing repository toward a first release. Explain its defining behavior: understand project context, produce an ordered plan, omit irrelevant steps with reasons, and attach contextual prompts for coding agents. Primary action: open the existing app. Secondary action: explore an illustrative agent workflow. Do not imply autonomous code execution or deployment unless those capabilities are confirmed.

## Existing application context
The user identified `/Users/nishhaamm/Desktop/007/` as part of this project. It contains an existing Next.js 16 / React 19 application named `devstep`, including its public marketing route, authentication, workspaces, project creation, and local codebase inspection. Its product model is Understand → Guide → Execute, serving new developers, students, and solo builders. The landing should connect project understanding with the agent workflow, with codebase context as the starting point. Keep roadmap capabilities distinct from shipped functionality. This preview does not modify or deploy that application's authentication, database, or private source.

## Directions considered
- **Product studio (recommended):** pale blue canvas, deep navy type, cobalt actions, and an interactive plan preview. Gives the product room to explain itself and makes its filtering behavior memorable.
- **Developer cockpit:** dark slate and compact terminal typography. Familiar to developers, but too close to the existing site's presentation.
- **Editorial launch:** oversized typography and linear storytelling. Strong visual identity, but less room for the product demonstration.

## Recommended visual system
- Cloud #F5F8FF: main canvas.
- White #FFFFFF: product surfaces.
- Ink #10213A: headings and navigation.
- Slate #58677C: supporting text.
- Cobalt #315CF5: primary actions and active steps.
- Amber #AE650B: explicit advice against unnecessary work.
- Typography: Space Grotesk display, Plus Jakarta Sans body, IBM Plex Mono for plan labels and prompts.
- Layout: generous desktop margins, asymmetric two-column hero, restrained rounded product surfaces, deliberate section spacing, and stacked mobile layouts.
- Signature: an interactive checklist that resolves into a shorter shipping plan, exposing the reason for every omitted step.

## Page structure
1. Compact navigation: DevCon identity, How it works, Example plan, FAQ, Open app.
2. Hero: “Meet the AI agent that knows what to build next.” Explain how DevCon turns an idea or repo into a focused path to shipping, with a primary app link and a secondary demo link beside a substantial agent-workspace preview.
3. Interactive example: switch between illustrative academic, competition, and commercial contexts; see a curated ordered plan and inspect omitted steps. Clearly label these as examples rather than generated results.
4. How it works: describe the project, focus the plan, use the contextual prompts. Match the claims to the existing site's documented capabilities.
5. Product detail: explained omissions, prompts grounded in a project's stack, and explicit advice against unnecessary work. Include a working copy-prompt interaction with confirmation.
6. FAQ: existing repository support, contexts, coding agent usage, and early-access status.
7. Closing app CTA and footer with the existing Docs destination.

## Behavior and boundaries
- Preserve the original app and documentation destinations at https://devcon-hazel.vercel.app/start and https://devcon-hazel.vercel.app/docs.
- No invented customer counts, testimonials, performance claims, or partner endorsements.
- Show early-access status honestly. Do not create a fake waitlist submission or claim that an email was saved without a connected backend.
- Responsive navigation, keyboard-operable demo and FAQ, visible focus, accessible contrast, and reduced-motion support.
- Use one brief filtering animation; keep other movement restrained.
- Build a standalone landing page in this workspace, with a separate preview. Replacing the existing Vercel deployment requires identifying its source and deployment project.

## Verification
Check desktop and mobile presentation, navigation destinations, context switching, omission explanations, clipboard feedback, FAQ operation, and reduced-motion behavior. Confirm there are no overflowing layouts or broken local assets.

## Review
The scope is one landing page. Product previews use local illustrative data. Existing app behavior and early-access claims remain bounded by what the live site describes. No backend or production migration is included.

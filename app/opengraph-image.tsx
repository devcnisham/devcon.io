import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_OG_SUBTITLE, SITE_TAGLINE } from "@/lib/site";

/**
 * The card people actually see when the link is pasted somewhere.
 *
 * Generated rather than a checked-in PNG, so it cannot drift from the tagline
 * — both read the same constants in `lib/site.ts`.
 *
 * Deliberately no external font fetch. `ImageResponse` would have to download
 * one at build time, which turns a network blip into a failed build, and the
 * system stack renders this fine at 1200×630.
 */

export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    // Satori supports a subset of CSS: flexbox yes, grid no, and every element
    // with more than one child needs an explicit `display: flex`.
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        backgroundColor: "#0a0a0b",
        backgroundImage:
          "radial-gradient(900px 600px at 10% -10%, rgba(56,132,180,0.28), transparent 60%), radial-gradient(800px 500px at 90% 0%, rgba(120,80,180,0.22), transparent 55%)",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 30,
          letterSpacing: -0.5,
          color: "#a3a3a3",
          fontFamily: "monospace",
        }}
      >
        devcon
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontSize: 82,
            fontWeight: 700,
            letterSpacing: -2,
            lineHeight: 1.05,
            color: "#ffffff",
          }}
        >
          {SITE_TAGLINE}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            maxWidth: 900,
            fontSize: 32,
            lineHeight: 1.4,
            color: "#a3a3a3",
          }}
        >
          {SITE_OG_SUBTITLE}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 26,
          color: "#737373",
          fontFamily: "monospace",
        }}
      >
        academic · competition · commercial
      </div>
    </div>,
    size,
  );
}

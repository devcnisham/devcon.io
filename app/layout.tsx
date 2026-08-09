import type { Metadata } from "next";
import "./globals.css";

/**
 * Real metadata from the first commit. v0.1 shipped "Create Next App" as its
 * title for its entire life, including in production.
 */
export const metadata: Metadata = {
  title: "devcon — ship plan",
  description:
    "Reads SHIP.md, runs the done-when checks, and shows what is claimed versus what is true.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

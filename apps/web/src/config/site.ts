export const siteConfig = {
  name: "devstep",
  shortName: "devstep",
  description: "Idea to production, in one place",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;

export type SiteConfig = typeof siteConfig;

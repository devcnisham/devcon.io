import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * There was no robots.txt at all.
 *
 * The dev-only API routes are disallowed as well as 404'd in production. The
 * 404 is the real control — this is belt-and-braces, and it stops a crawler
 * burning budget on paths that will never serve anything.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

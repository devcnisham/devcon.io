import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * The three pages a crawler should know about.
 *
 * `/canvas` is deliberately absent. With no project loaded it is an empty state
 * telling you to go and pick one, and its content lives in browser
 * `localStorage` — there is nothing there to index, and indexing it would put a
 * blank screen in front of anyone who arrived from search.
 *
 * No `lastModified`. A build timestamp would claim every page changed on every
 * deploy, which trains a crawler to stop believing the field.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/start`, changeFrequency: "monthly", priority: 0.5 },
  ];
}

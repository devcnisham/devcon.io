import type { ProjectType } from "./wizard";

/**
 * Technology catalogue for manual selection during project creation.
 *
 * This is the *stated* stack — what the developer says they are using. Steps
 * 09 and 10 of the build order add detection, which reads the real stack from
 * the codebase. The two are kept separate on purpose: a mismatch between what
 * someone believes they are using and what is actually installed is a signal
 * worth surfacing, not an inconsistency to paper over.
 */

export const TECHNOLOGY_CATEGORIES = [
  "language",
  "frontend",
  "backend",
  "database",
  "styling",
  "testing",
  "infrastructure",
] as const;

export type TechnologyCategory = (typeof TECHNOLOGY_CATEGORIES)[number];

export type Technology = {
  id: string;
  name: string;
  category: TechnologyCategory;
  /** Alternative spellings people actually type. */
  aliases?: string[];
};

export const TECHNOLOGIES: Technology[] = [
  {
    id: "typescript",
    name: "TypeScript",
    category: "language",
    aliases: ["ts"],
  },
  {
    id: "javascript",
    name: "JavaScript",
    category: "language",
    aliases: ["js"],
  },
  { id: "python", name: "Python", category: "language" },
  { id: "go", name: "Go", category: "language", aliases: ["golang"] },
  { id: "rust", name: "Rust", category: "language" },
  { id: "java", name: "Java", category: "language" },
  { id: "ruby", name: "Ruby", category: "language" },
  { id: "php", name: "PHP", category: "language" },
  { id: "swift", name: "Swift", category: "language" },
  { id: "kotlin", name: "Kotlin", category: "language" },

  { id: "react", name: "React", category: "frontend" },
  {
    id: "nextjs",
    name: "Next.js",
    category: "frontend",
    aliases: ["next", "next.js"],
  },
  {
    id: "vue",
    name: "Vue",
    category: "frontend",
    aliases: ["vuejs", "vue.js"],
  },
  {
    id: "svelte",
    name: "Svelte",
    category: "frontend",
    aliases: ["sveltekit"],
  },
  { id: "angular", name: "Angular", category: "frontend" },
  { id: "react-native", name: "React Native", category: "frontend" },
  { id: "flutter", name: "Flutter", category: "frontend" },

  {
    id: "node",
    name: "Node.js",
    category: "backend",
    aliases: ["nodejs", "node.js"],
  },
  { id: "express", name: "Express", category: "backend" },
  { id: "fastapi", name: "FastAPI", category: "backend" },
  { id: "django", name: "Django", category: "backend" },
  {
    id: "rails",
    name: "Rails",
    category: "backend",
    aliases: ["ruby on rails"],
  },
  { id: "laravel", name: "Laravel", category: "backend" },
  { id: "graphql", name: "GraphQL", category: "backend" },

  {
    id: "postgres",
    name: "PostgreSQL",
    category: "database",
    aliases: ["postgresql"],
  },
  { id: "mysql", name: "MySQL", category: "database" },
  { id: "sqlite", name: "SQLite", category: "database" },
  { id: "mongodb", name: "MongoDB", category: "database", aliases: ["mongo"] },
  { id: "redis", name: "Redis", category: "database" },
  { id: "supabase", name: "Supabase", category: "database" },
  { id: "prisma", name: "Prisma", category: "database" },
  { id: "drizzle", name: "Drizzle", category: "database" },

  {
    id: "tailwind",
    name: "Tailwind CSS",
    category: "styling",
    aliases: ["tailwindcss"],
  },
  { id: "css", name: "CSS", category: "styling" },
  { id: "sass", name: "Sass", category: "styling", aliases: ["scss"] },

  { id: "vitest", name: "Vitest", category: "testing" },
  { id: "jest", name: "Jest", category: "testing" },
  { id: "playwright", name: "Playwright", category: "testing" },
  { id: "cypress", name: "Cypress", category: "testing" },

  { id: "docker", name: "Docker", category: "infrastructure" },
  { id: "vercel", name: "Vercel", category: "infrastructure" },
  { id: "aws", name: "AWS", category: "infrastructure" },
  { id: "github-actions", name: "GitHub Actions", category: "infrastructure" },
];

const BY_ID = new Map(TECHNOLOGIES.map((tech) => [tech.id, tech]));

export function findTechnology(id: string): Technology | undefined {
  return BY_ID.get(id);
}

/** Matches on name, id, and alias. An empty query returns everything. */
export function searchTechnologies(query: string): Technology[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return TECHNOLOGIES;

  return TECHNOLOGIES.filter((tech) => {
    const haystack = [tech.name, tech.id, ...(tech.aliases ?? [])];
    return haystack.some((value) => value.toLowerCase().includes(needle));
  });
}

/** Adds or removes an id. Unknown ids are ignored rather than stored. */
export function toggleTechnology(selected: string[], id: string): string[] {
  if (!BY_ID.has(id)) return [...selected];

  return selected.includes(id)
    ? selected.filter((value) => value !== id)
    : [...selected, id];
}

const SUGGESTIONS: Record<ProjectType, string[]> = {
  saas: ["typescript", "nextjs", "react", "tailwind", "postgres", "supabase"],
  website: ["typescript", "nextjs", "tailwind", "vercel"],
  "web-app": ["typescript", "react", "nextjs", "tailwind", "postgres"],
  api: ["typescript", "node", "postgres", "docker"],
  "mobile-app": ["typescript", "react-native", "swift", "kotlin"],
  "desktop-app": ["typescript", "rust", "react"],
  "ai-app": ["python", "typescript", "fastapi", "postgres"],
  ecommerce: ["typescript", "nextjs", "tailwind", "postgres"],
  other: ["typescript"],
};

/** A starting point for the stack step — never a constraint. */
export function suggestedFor(type: ProjectType): string[] {
  return SUGGESTIONS[type] ?? [];
}

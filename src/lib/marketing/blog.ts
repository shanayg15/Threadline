import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import matter from "gray-matter";

/**
 * Tiny filesystem-backed blog. Posts are markdown files with YAML frontmatter in
 * `src/content/blog/`. Read at build time in server components (static), so no client
 * bundle cost and no database. Keep it boring — this is a seed blog, not a CMS.
 */

export type BlogMeta = {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO yyyy-mm-dd
  author: string;
  readingMinutes: number;
  tag: string;
};

export type BlogPost = BlogMeta & { content: string };

const BLOG_DIR = join(process.cwd(), "src/content/blog");

function parseFile(filename: string): BlogPost {
  const slug = filename.replace(/\.md$/, "");
  const raw = readFileSync(join(BLOG_DIR, filename), "utf8");
  const { data, content } = matter(raw);
  const words = content.split(/\s+/).filter(Boolean).length;
  return {
    slug,
    title: String(data.title ?? slug),
    description: String(data.description ?? ""),
    date: String(data.date ?? ""),
    author: String(data.author ?? "The Threadline team"),
    tag: String(data.tag ?? "Notes"),
    readingMinutes: Math.max(1, Math.round(words / 200)),
    content,
  };
}

/** All posts, newest first. */
export function getAllPosts(): BlogPost[] {
  return readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".md"))
    .map(parseFile)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostSlugs(): string[] {
  return getAllPosts().map((p) => p.slug);
}

export function getPost(slug: string): BlogPost | null {
  return getAllPosts().find((p) => p.slug === slug) ?? null;
}

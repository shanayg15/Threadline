import Link from "next/link";

import type { BlogMeta } from "@/lib/marketing/blog";
import { formatPostDate } from "@/lib/marketing/format";

/** A muted "cover" carrying just the post tag — keeps imagery license-clean (no stock). */
export function PostCard({ post }: { post: BlogMeta }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-foreground/30"
    >
      <div className="flex aspect-[16/9] items-end border-b border-border bg-muted p-5">
        <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {post.tag}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-serif text-xl font-medium leading-snug">{post.title}</h3>
        <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">{post.description}</p>
        <p className="mt-4 text-xs text-muted-foreground">
          {formatPostDate(post.date)} · {post.readingMinutes} min read
        </p>
      </div>
    </Link>
  );
}

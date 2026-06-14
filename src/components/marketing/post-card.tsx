import Link from "next/link";

import type { BlogMeta } from "@/lib/marketing/blog";
import { formatPostDate } from "@/lib/marketing/format";

/** A coral-tinted "cover" derived from the post tag — keeps imagery license-clean (no stock). */
export function PostCard({ post }: { post: BlogMeta }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-md"
    >
      <div className="flex aspect-[16/9] items-end bg-gradient-to-br from-primary/20 via-primary/5 to-card p-5">
        <span className="rounded-full bg-background/80 px-3 py-1 text-xs font-semibold text-primary">
          {post.tag}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-semibold leading-snug transition-colors group-hover:text-primary">
          {post.title}
        </h3>
        <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">{post.description}</p>
        <p className="mt-4 text-xs text-muted-foreground">
          {formatPostDate(post.date)} · {post.readingMinutes} min read
        </p>
      </div>
    </Link>
  );
}

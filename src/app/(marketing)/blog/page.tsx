import type { Metadata } from "next";

import { PostCard } from "@/components/marketing/post-card";
import { SectionHeading } from "@/components/marketing/section-heading";
import { getAllPosts } from "@/lib/marketing/blog";

export const metadata: Metadata = {
  title: "Blog — Threadline",
  description:
    "Notes on the post-purchase text thread: why a conversation beats a broadcast, what customers tell you after delivery, and how to measure real lift with a holdout.",
  alternates: { canonical: "/blog" },
};

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-6 lg:py-20">
      <SectionHeading
        align="left"
        eyebrow="Blog"
        title="From the Threadline team"
        lead="How we think about the conversation that happens before checkout and after the box arrives."
      />

      <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </div>
  );
}

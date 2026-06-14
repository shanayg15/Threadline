"use client";

import Link from "next/link";
import { ArrowRight, Menu } from "lucide-react";
import { useEffect, useState } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BOOK_A_DEMO_URL, NAV_LINKS } from "@/lib/marketing/config";
import { cn } from "@/lib/utils";

/**
 * Sticky marketing header: transparent over the hero, then a frosted solid bar once the
 * page scrolls. Desktop nav anchors to the page sections; a Sheet holds the mobile menu.
 */
export function MarketingHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-colors duration-300",
        scrolled
          ? "border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-6">
        <Link href="/" aria-label="Threadline home">
          <BrandLogo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Button key={link.href} asChild variant="ghost" size="sm">
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={BOOK_A_DEMO_URL}>Book a demo</a>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">
              Get started
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        {/* Mobile menu */}
        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle className="text-left">
                <BrandLogo />
              </SheetTitle>
            </SheetHeader>
            <nav className="mt-6 flex flex-col gap-1" aria-label="Mobile">
              {NAV_LINKS.map((link) => (
                <SheetClose asChild key={link.href}>
                  <Link
                    href={link.href}
                    className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent"
                  >
                    {link.label}
                  </Link>
                </SheetClose>
              ))}
            </nav>
            <div className="mt-6 flex flex-col gap-2">
              <SheetClose asChild>
                <Button asChild variant="outline">
                  <a href={BOOK_A_DEMO_URL}>Book a demo</a>
                </Button>
              </SheetClose>
              <SheetClose asChild>
                <Button asChild>
                  <Link href="/signup">
                    Get started
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </SheetClose>
              <SheetClose asChild>
                <Button asChild variant="ghost">
                  <Link href="/login">Sign in</Link>
                </Button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

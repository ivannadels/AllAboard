"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrainIcon } from "@/components/aa/icons";
import { DEMO_USER } from "@/lib/demo-user";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Search", active: (p: string) => p === "/" },
  { href: "/trips", label: "Trips", active: (p: string) => p.startsWith("/trips") },
];

export function SiteHeader() {
  const pathname = usePathname();
  const wide = pathname.startsWith("/trips/");
  return (
    <header className="border-b-2 border-ink bg-white">
      <div className={cn("mx-auto flex flex-wrap items-center gap-4 px-4 py-3.5 sm:px-8", wide ? "max-w-[1440px]" : "max-w-[1280px]")}>
        <Link href="/" className="flex items-center gap-2.5 text-ink no-underline hover:text-ink">
          <TrainIcon size={30} className="flex-none" />
          <span className="font-display-heavy text-[22px] tracking-[-0.4px]">AllAboard</span>
        </Link>
        <div className="flex-1" />
        <nav className="flex gap-1 text-sm font-bold">
          {NAV.map((n) => {
            const active = n.active(pathname);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-[10px] px-3.5 no-underline",
                  active ? "bg-ink text-lime hover:text-lime" : "text-ink hover:bg-mint hover:text-ink",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div
          title={`${DEMO_USER.name} (demo user)`}
          className="flex size-[38px] items-center justify-center rounded-full border-2 border-ink bg-lime text-[13px] font-extrabold"
        >
          {DEMO_USER.initials}
        </div>
      </div>
    </header>
  );
}

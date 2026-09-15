"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/learn", label: "Learn" },
  { href: "/drills", label: "Drills" },
  { href: "/play", label: "Table" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-felt-950/80 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-full bg-brass-400 text-lg text-felt-950 shadow-[0_0_0_3px_rgb(226_187_102/0.2)] transition group-hover:rotate-12">
            ♠
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-brass-200">True Count</span>
        </Link>
        <ul className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition sm:px-4 ${
                    active ? "bg-brass-400 text-felt-950" : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}

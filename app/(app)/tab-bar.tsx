"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Heute" },
  { href: "/training", label: "Training" },
  { href: "/essen", label: "Essen" },
  { href: "/fortschritt", label: "Fortschritt" },
  { href: "/konto", label: "Konto" },
];

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="tabbar" aria-label="Hauptnavigation">
      {TABS.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} className="tab" aria-current={active ? "page" : undefined}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

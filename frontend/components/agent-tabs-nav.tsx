"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export type AgentTab = {
  id: string;
  label: string;
  hint?: string;
};

export function AgentTabsNav({
  tabs,
  active,
}: {
  tabs: AgentTab[];
  active: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <nav
      className="-mx-1 flex flex-wrap gap-1 overflow-x-auto"
      role="tablist"
      aria-label="Agent settings"
    >
      {tabs.map((t) => {
        const isActive = t.id === active;
        const next = new URLSearchParams(params?.toString() ?? "");
        next.set("tab", t.id);
        const href = `${pathname}?${next.toString()}`;
        return (
          <Link
            key={t.id}
            href={href}
            scroll={false}
            role="tab"
            aria-selected={isActive}
            className={
              isActive
                ? "inline-flex h-8 items-center rounded-md bg-surface-2 px-3 text-xs font-medium text-foreground"
                : "inline-flex h-8 items-center rounded-md px-3 text-xs font-medium text-muted transition hover:bg-surface-2/60 hover:text-foreground"
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavItemDef = {
  href: string;
  label: string;
  icon: ReactNode;
  soon?: boolean;
};

const NAV: NavItemDef[] = [
  { href: "/dashboard", label: "Overview", icon: <HomeIcon /> },
  { href: "/dashboard/agents", label: "Agents", icon: <AgentIcon /> },
  { href: "/dashboard/knowledge", label: "Knowledge", icon: <KnowledgeIcon /> },
  { href: "/dashboard/calls", label: "Calls", icon: <CallsIcon /> },
  {
    href: "/dashboard/phone-numbers",
    label: "Phone numbers",
    icon: <PhoneIcon />,
    soon: true,
  },
  {
    href: "/dashboard/telephony",
    label: "Telephony",
    icon: <TelephonyIcon />,
    soon: true,
  },
];

export function DashboardSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const initial = userEmail.trim()[0]?.toUpperCase() ?? "?";

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-border/80 bg-surface/40">
      <div className="px-5 py-5">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-foreground transition hover:opacity-80"
        >
          <span className="grid size-7 place-items-center rounded-md bg-accent/15 text-accent">
            <LogoMark />
          </span>
          <span className="text-sm font-semibold tracking-tight">Timbre</span>
        </Link>
      </div>

      <nav className="flex-1 px-3">
        <ul className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active = isActive(item.href);
            const soonPill = item.soon ? (
              <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-amber-400">
                Soon
              </span>
            ) : null;

            if (item.soon) {
              return (
                <li key={item.href}>
                  <span
                    aria-disabled
                    title="Coming soon"
                    className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-2/70"
                  >
                    <span className="text-muted-2/60" aria-hidden>
                      {item.icon}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {soonPill}
                  </span>
                </li>
              );
            }

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={
                    active
                      ? "flex items-center gap-2.5 rounded-md bg-surface-2 px-2.5 py-1.5 text-sm text-foreground"
                      : "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted transition hover:bg-surface-2/60 hover:text-foreground"
                  }
                >
                  <span
                    className={active ? "text-accent" : "text-muted-2"}
                    aria-hidden
                  >
                    {item.icon}
                  </span>
                  <span className="flex-1">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border/80 px-3 py-3">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-medium text-foreground">
            {initial}
          </div>
          <div className="min-w-0 flex-1 truncate text-xs text-muted">
            {userEmail}
          </div>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="mt-1 w-full rounded-md px-2.5 py-1.5 text-left text-xs text-muted transition hover:bg-surface-2/60 hover:text-foreground"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}

function LogoMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <rect x="2" y="5" width="1.2" height="4" rx="0.6" fill="currentColor" />
      <rect x="4.4" y="3" width="1.2" height="8" rx="0.6" fill="currentColor" />
      <rect x="6.8" y="4" width="1.2" height="6" rx="0.6" fill="currentColor" />
      <rect x="9.2" y="2" width="1.2" height="10" rx="0.6" fill="currentColor" />
      <rect x="11.6" y="5" width="1.2" height="4" rx="0.6" fill="currentColor" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <path
        d="M2.5 6.5L7.5 2.5L12.5 6.5V12.5H9.5V9H5.5V12.5H2.5V6.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AgentIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <rect
        x="2.5"
        y="4.5"
        width="10"
        height="7"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle cx="5.5" cy="8" r="0.8" fill="currentColor" />
      <circle cx="9.5" cy="8" r="0.8" fill="currentColor" />
      <path
        d="M7.5 2.5V4.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function KnowledgeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <path
        d="M3 3h6.5L12 5.5V12H3V3Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 3v2.5H12"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M5 7.5h5M5 9.5h5M5 11h3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CallsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <rect
        x="2.5"
        y="3"
        width="10"
        height="9"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M5 6h5M5 8.5h5M5 11h3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <path
        d="M3.2 3.9c.4-.9 1.4-1.5 2.4-1.3l.5.1c.5.1.8.5.9 1l.3 1.5c.1.4-.1.8-.4 1.1l-.7.5c.7 1.3 1.7 2.3 3 3l.5-.7c.3-.3.7-.5 1.1-.4l1.5.3c.5.1.9.4 1 .9l.1.5c.2 1-.4 2-1.3 2.4-3.2 1.3-6.9-.5-8.2-3.7-.8-2-.7-3.5-.7-3.5z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function TelephonyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <path
        d="M2 4h11M2 7.5h11M2 11h11"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="4" cy="4" r="0.8" fill="currentColor" />
      <circle cx="10" cy="7.5" r="0.8" fill="currentColor" />
      <circle cx="6" cy="11" r="0.8" fill="currentColor" />
    </svg>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="relative flex flex-1 items-center justify-center px-6 py-16">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(255,157,92,0.14) 0%, transparent 55%)",
        }}
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted transition hover:text-foreground"
          >
            <span className="text-base font-semibold tracking-tight text-foreground">
              Timbre
            </span>
          </Link>
          <h1 className="text-3xl tracking-tight">
            {title.split(" ").map((word, i, arr) =>
              i === arr.length - 1 ? (
                <span key={i} className="font-serif italic text-accent">
                  {word}
                </span>
              ) : (
                <span key={i}>{word} </span>
              ),
            )}
          </h1>
          <p className="mt-2 text-sm text-muted">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface/60 p-6 backdrop-blur">
          {children}
        </div>
        <p className="mt-6 text-center text-sm text-muted">{footer}</p>
      </div>
    </div>
  );
}

export function Field({
  label,
  name,
  type,
  required,
}: {
  label: string;
  name: string;
  type: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        autoComplete={
          type === "password"
            ? name === "password"
              ? "current-password"
              : "new-password"
            : type === "email"
              ? "email"
              : undefined
        }
        className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-1 focus:ring-accent/40"
      />
    </label>
  );
}

export function Divider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-muted-2">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3c-1.7 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.5 29.3 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.3-.1-2.6-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.1l6.6 4.8C14.6 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.5 29.3 4.5 24 4.5c-7.5 0-14 4.3-17.7 10.6z"
      />
      <path
        fill="#4CAF50"
        d="M24 43.5c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.8 39.1 16.4 43.5 24 43.5z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.4 4.3-4.4 5.6l6.2 5.2c-.4.4 6.9-5 6.9-14.9 0-1.3-.1-2.6-.4-3.9z"
      />
    </svg>
  );
}

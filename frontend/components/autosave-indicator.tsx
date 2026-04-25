import type { AutosaveStatus } from "@/lib/use-autosave";

export function AutosaveIndicator({
  status,
  error,
}: {
  status: AutosaveStatus;
  error?: string | null;
}) {
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-400">
        <Dot className="bg-red-400" />
        {error ?? "Save failed"}
      </span>
    );
  }
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
        <Spinner />
        Saving…
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-2">
        <Dot className="bg-muted-2" />
        Unsaved changes
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-2">
        <Dot className="bg-emerald-400" />
        Saved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-2">
      <Dot className="bg-muted-2/60" />
      Autosave on
    </span>
  );
}

function Dot({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-1.5 shrink-0 rounded-full ${className}`}
    />
  );
}

function Spinner() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      className="animate-spin text-muted"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="40"
        strokeDashoffset="16"
        fill="none"
      />
    </svg>
  );
}

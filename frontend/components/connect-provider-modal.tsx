"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";

type Props = {
  onClose: () => void;
  onConnected: () => void;
};

export function ConnectProviderModal({ onClose, onConnected }: Props) {
  const [type] = useState<"twilio">("twilio");
  const [label, setLabel] = useState("");
  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [sipUsername, setSipUsername] = useState("");
  const [sipPassword, setSipPassword] = useState("");
  const [terminationUri, setTerminationUri] = useState("");
  const [instructions, setInstructions] = useState<string[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await apiFetch(`/telephony/providers/setup/${type}`);
      if (res.ok) {
        const body = (await res.json()) as { instructions: string[] };
        setInstructions(body.instructions);
      }
    })();
  }, [type]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const res = await apiFetch("/telephony/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        label: label.trim(),
        credentials: {
          type,
          accountSid: accountSid.trim(),
          authToken: authToken.trim(),
          sipUsername: sipUsername.trim(),
          sipPassword: sipPassword.trim(),
          terminationUri: terminationUri.trim(),
        },
      }),
    });

    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Failed to connect provider");
      return;
    }
    onConnected();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-4 flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-2xl shadow-black/60">
        <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-accent">
              Telephony
            </p>
            <h2 className="mt-0.5 text-sm font-medium">Connect Twilio</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {instructions ? (
            <div className="mb-5 rounded-md border border-border bg-background/40 p-4">
              <h3 className="text-xs font-medium text-foreground">
                Setup in Twilio
              </h3>
              <ol className="mt-2 list-decimal pl-5 text-xs text-muted space-y-1.5">
                {instructions.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <Field label="Connection label" value={label} onChange={setLabel} />
            <Field
              label="Account SID"
              value={accountSid}
              onChange={setAccountSid}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
            <Field
              label="Auth token"
              value={authToken}
              onChange={setAuthToken}
              type="password"
            />
            <Field
              label="SIP username"
              value={sipUsername}
              onChange={setSipUsername}
            />
            <Field
              label="SIP password"
              value={sipPassword}
              onChange={setSipPassword}
              type="password"
            />
            <Field
              label="Termination URI"
              value={terminationUri}
              onChange={setTerminationUri}
              placeholder="your-trunk.pstn.twilio.com"
            />
            {error ? <p className="text-xs text-red-400">{error}</p> : null}

            <div className="mt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 items-center rounded-md px-3 text-sm text-muted transition hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-9 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background transition hover:bg-accent-soft disabled:opacity-60"
              >
                {pending ? "Connecting…" : "Connect"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        required
        autoComplete="off"
        className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-1 focus:ring-accent/40"
      />
    </label>
  );
}

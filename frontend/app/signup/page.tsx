"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AuthShell,
  Divider,
  Field,
  GoogleIcon,
} from "@/components/auth-shell";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: String(form.get("email")),
      password: String(form.get("password")),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setPending(false);

    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setInfo("Check your email to confirm your account.");
    }
  }

  async function handleGoogle() {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start building voice agents in minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <button
        type="button"
        onClick={handleGoogle}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border-strong bg-background text-sm font-medium transition hover:bg-surface"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <Divider />

      <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
        <Field label="Email" name="email" type="email" required />
        <Field label="Password" name="password" type="password" required />
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
        {info ? <p className="text-xs text-accent-soft">{info}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="mt-1 flex h-11 w-full items-center justify-center rounded-lg bg-foreground text-sm font-medium text-background transition hover:bg-accent-soft disabled:opacity-60"
        >
          {pending ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}

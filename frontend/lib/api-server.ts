import { createClient } from "@/lib/supabase/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export async function serverApiFetch(path: string, init: RequestInit = {}) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  return fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

import { Hono } from "hono";
import { env } from "../env";
import { requireAuth } from "../middleware/auth";

const CARTESIA_BASE = "https://api.cartesia.ai";

type CartesiaVoice = {
  id: string;
  name: string;
  description: string;
  gender: "masculine" | "feminine" | "gender_neutral" | null;
  language: string;
  is_owner: boolean;
  is_public: boolean;
  created_at: string;
  preview_file_url?: string | null;
};

type CartesiaVoicesResponse = {
  data: CartesiaVoice[];
  has_more: boolean;
  next_page?: string | null;
};

function cartesiaHeaders() {
  return {
    Authorization: `Bearer ${env.CARTESIA_API_KEY}`,
    "Cartesia-Version": env.CARTESIA_API_VERSION,
  };
}

function strip(voice: CartesiaVoice): CartesiaVoice {
  const { preview_file_url, ...rest } = voice;
  void preview_file_url;
  return rest;
}

const voicesRouter = new Hono();

voicesRouter.use("*", requireAuth);

voicesRouter.get("/", async (c) => {
  const url = new URL(`${CARTESIA_BASE}/voices`);
  const forward = ["q", "gender", "language", "limit", "starting_after"];
  for (const key of forward) {
    const value = c.req.query(key);
    if (value) url.searchParams.set(key, value);
  }
  url.searchParams.append("expand[]", "preview_file_url");

  const res = await fetch(url, { headers: cartesiaHeaders() });
  if (!res.ok) {
    return c.json({ error: "upstream" }, 502);
  }

  const body = (await res.json()) as CartesiaVoicesResponse;
  return c.json({
    data: body.data.map(strip),
    has_more: body.has_more,
    next_page: body.next_page ?? null,
  });
});

voicesRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const res = await fetch(`${CARTESIA_BASE}/voices/${encodeURIComponent(id)}`, {
    headers: cartesiaHeaders(),
  });
  if (res.status === 404) return c.json({ error: "not found" }, 404);
  if (!res.ok) return c.json({ error: "upstream" }, 502);

  const voice = (await res.json()) as CartesiaVoice;
  return c.json({ voice: strip(voice) });
});

const PREVIEW_PHRASE =
  "Hi, I'm your voice agent. This is a short sample of how I sound.";
const PREVIEW_MODEL = "sonic-3";

// Cartesia's `preview_file_url` is only servable to Clerk session tokens from
// play.cartesia.ai — the public `sk_car_...` API key can't fetch it. Instead we
// synthesize a short phrase via `/tts/bytes`, which accepts the API key.
voicesRouter.get("/:id/preview", async (c) => {
  const id = c.req.param("id");

  const metaRes = await fetch(
    `${CARTESIA_BASE}/voices/${encodeURIComponent(id)}`,
    { headers: cartesiaHeaders() },
  );
  if (metaRes.status === 404) return c.json({ error: "not found" }, 404);
  if (!metaRes.ok) {
    const detail = await metaRes.text().catch(() => "");
    console.error("cartesia meta failed", {
      id,
      status: metaRes.status,
      detail,
    });
    return c.json({ error: "upstream_meta" }, 502);
  }

  const voice = (await metaRes.json()) as CartesiaVoice;

  const ttsRes = await fetch(`${CARTESIA_BASE}/tts/bytes`, {
    method: "POST",
    headers: {
      ...cartesiaHeaders(),
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      model_id: PREVIEW_MODEL,
      transcript: PREVIEW_PHRASE,
      voice: { mode: "id", id },
      language: voice.language,
      output_format: {
        container: "mp3",
        sample_rate: 44100,
        bit_rate: 128000,
      },
    }),
  });

  if (!ttsRes.ok || !ttsRes.body) {
    const detail = await ttsRes.text().catch(() => "");
    console.error("cartesia tts preview failed", {
      id,
      status: ttsRes.status,
      detail,
    });
    return c.json({ error: "upstream_tts" }, 502);
  }

  return new Response(ttsRes.body, {
    status: 200,
    headers: {
      "Content-Type": ttsRes.headers.get("Content-Type") ?? "audio/mpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
});

export default voicesRouter;

/**
 * Tiny in-process cache around Cartesia's voice metadata. Used by the
 * dispatch-metadata builder so the agent runtime knows the voice's gender
 * (and friends) without needing a Cartesia client of its own.
 */

import { env } from "../env";

const CARTESIA_BASE = "https://api.cartesia.ai";
const TTL_MS = 5 * 60 * 1000;

export type VoiceGender = "masculine" | "feminine" | "gender_neutral";

export type VoiceInfo = {
  id: string;
  name: string;
  language: string;
  gender: VoiceGender | null;
};

type CacheEntry = { value: VoiceInfo | null; expiresAt: number };
const cache = new Map<string, CacheEntry>();

export async function getVoiceInfo(
  voiceId: string,
): Promise<VoiceInfo | null> {
  if (!voiceId) return null;
  const now = Date.now();
  const cached = cache.get(voiceId);
  if (cached && cached.expiresAt > now) return cached.value;

  let value: VoiceInfo | null = null;
  try {
    const res = await fetch(
      `${CARTESIA_BASE}/voices/${encodeURIComponent(voiceId)}`,
      {
        headers: {
          Authorization: `Bearer ${env.CARTESIA_API_KEY}`,
          "Cartesia-Version": env.CARTESIA_API_VERSION,
        },
      },
    );
    if (res.ok) {
      const body = (await res.json()) as {
        id: string;
        name: string;
        language: string;
        gender: VoiceGender | null;
      };
      value = {
        id: body.id,
        name: body.name,
        language: body.language,
        gender: body.gender ?? null,
      };
    }
  } catch (err) {
    console.warn("getVoiceInfo failed", { voiceId, err });
  }

  cache.set(voiceId, { value, expiresAt: now + TTL_MS });
  return value;
}

export function clearVoiceInfoCache() {
  cache.clear();
}

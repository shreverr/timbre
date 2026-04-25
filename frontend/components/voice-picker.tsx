"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { Voice, VoiceGender, VoiceListResponse } from "@/lib/types";

type Props = {
  agentId: string;
  currentVoiceId: string | null;
  currentVoiceName?: string | null;
};

const COMMON_LANGUAGES: Array<{ code: string; label: string }> = [
  { code: "", label: "Any language" },
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "hi", label: "Hindi" },
  { code: "ja", label: "Japanese" },
  { code: "pt", label: "Portuguese" },
  { code: "zh", label: "Chinese" },
  { code: "it", label: "Italian" },
];

export function VoicePicker({
  agentId,
  currentVoiceId,
  currentVoiceName,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center rounded-lg border border-border-strong px-4 text-sm text-foreground transition hover:bg-surface-2"
      >
        {currentVoiceId ? "Change voice" : "Select voice"}
      </button>
      {open ? (
        <VoicePickerModal
          agentId={agentId}
          currentVoiceId={currentVoiceId}
          currentVoiceName={currentVoiceName}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function VoicePickerModal({
  agentId,
  currentVoiceId,
  onClose,
}: Props & { onClose: () => void }) {
  const router = useRouter();

  const [q, setQ] = useState("");
  const [gender, setGender] = useState<VoiceGender | "">("");
  const [language, setLanguage] = useState("en");

  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlsRef = useRef<string[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());

  const fetchVoices = useCallback(
    async (opts: { startingAfter?: string; append?: boolean } = {}) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (gender) params.set("gender", gender);
        if (language) params.set("language", language);
        params.set("limit", "30");
        if (opts.startingAfter) params.set("starting_after", opts.startingAfter);

        const res = await apiFetch(`/voices?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load voices");
        const body = (await res.json()) as VoiceListResponse;
        setVoices((prev) => (opts.append ? [...prev, ...body.data] : body.data));
        setHasMore(body.has_more);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load voices");
      } finally {
        setLoading(false);
      }
    },
    [q, gender, language],
  );

  useEffect(() => {
    const handle = setTimeout(() => {
      void fetchVoices();
    }, 300);
    return () => clearTimeout(handle);
  }, [fetchVoices]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.src = "";
      }
      for (const url of blobUrlsRef.current) URL.revokeObjectURL(url);
      blobUrlsRef.current = [];
    };
  }, []);

  async function playPreview(voiceId: string) {
    const audio = audioRef.current;
    if (!audio) return;

    if (playingId === voiceId) {
      audio.pause();
      setPlayingId(null);
      return;
    }

    setLoadingPreview(voiceId);
    try {
      const res = await apiFetch(`/voices/${encodeURIComponent(voiceId)}/preview`);
      if (!res.ok) throw new Error("preview unavailable");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      blobUrlsRef.current.push(url);

      audio.src = url;
      audio.onended = () => setPlayingId(null);
      await audio.play();
      setPlayingId(voiceId);
    } catch {
      setUnavailable((prev) => {
        const next = new Set(prev);
        next.add(voiceId);
        return next;
      });
    } finally {
      setLoadingPreview(null);
    }
  }

  async function selectVoice(voiceId: string) {
    setSelecting(voiceId);
    try {
      const res = await apiFetch(`/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId }),
      });
      if (!res.ok) throw new Error("save failed");
      onClose();
      router.refresh();
    } catch {
      setError("Failed to save voice. Try again.");
    } finally {
      setSelecting(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-4 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-black/50">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-accent">
              Voices
            </p>
            <h2 className="mt-1 text-xl tracking-tight">
              Pick a{" "}
              <span className="font-serif italic text-accent-soft">voice</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row">
          <input
            type="search"
            value={q}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
            placeholder="Search by name or description"
            className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-border-strong focus:ring-1 focus:ring-accent/40"
          />
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as VoiceGender | "")}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-border-strong"
          >
            <option value="">Any gender</option>
            <option value="feminine">Feminine</option>
            <option value="masculine">Masculine</option>
            <option value="gender_neutral">Gender-neutral</option>
          </select>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-border-strong"
          >
            {COMMON_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error ? (
            <p className="mb-3 text-xs text-red-400">{error}</p>
          ) : null}

          {loading && voices.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Loading…</p>
          ) : voices.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              No voices match your filters.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {voices.map((v) => {
                const selected = v.id === currentVoiceId;
                return (
                  <li
                    key={v.id}
                    className={
                      selected
                        ? "flex items-start gap-3 rounded-xl border border-accent/60 bg-accent/10 px-4 py-3"
                        : "flex items-start gap-3 rounded-xl border border-border bg-background/40 px-4 py-3 hover:border-border-strong"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => playPreview(v.id)}
                      disabled={
                        loadingPreview === v.id || unavailable.has(v.id)
                      }
                      className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border-strong bg-surface-2 text-foreground transition hover:bg-accent/20 disabled:opacity-40"
                      aria-label={
                        unavailable.has(v.id)
                          ? "Preview unavailable"
                          : playingId === v.id
                            ? "Pause preview"
                            : "Play preview"
                      }
                      title={
                        unavailable.has(v.id)
                          ? "Preview unavailable"
                          : undefined
                      }
                    >
                      {loadingPreview === v.id ? (
                        <Spinner />
                      ) : unavailable.has(v.id) ? (
                        <MuteIcon />
                      ) : playingId === v.id ? (
                        <PauseIcon />
                      ) : (
                        <PlayIcon />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-foreground">
                          {v.name}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-muted-2">
                          {v.language}
                          {v.gender ? ` · ${v.gender.replace("_", " ")}` : ""}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                        {v.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => selectVoice(v.id)}
                      disabled={selected || selecting === v.id}
                      className={
                        selected
                          ? "inline-flex h-8 items-center rounded-md border border-accent/40 bg-accent/20 px-3 text-xs font-medium text-accent"
                          : "inline-flex h-8 items-center rounded-md bg-foreground px-3 text-xs font-medium text-background transition hover:bg-accent-soft disabled:opacity-60"
                      }
                    >
                      {selected
                        ? "Selected"
                        : selecting === v.id
                          ? "Saving…"
                          : "Select"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {hasMore ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  void fetchVoices({
                    startingAfter: voices[voices.length - 1]?.id,
                    append: true,
                  })
                }
                className="inline-flex h-9 items-center rounded-md border border-border-strong px-4 text-xs text-foreground transition hover:bg-surface-2 disabled:opacity-60"
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </div>

        <audio ref={audioRef} preload="none" />
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path d="M2 1.5l6 3.5-6 3.5V1.5z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <rect x="2" y="1.5" width="2" height="7" fill="currentColor" />
      <rect x="6" y="1.5" width="2" height="7" fill="currentColor" />
    </svg>
  );
}

function MuteIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2 4.5h1.5L5.5 3v6L3.5 7.5H2v-3z"
        fill="currentColor"
      />
      <path
        d="M7.5 4.5l3 3M10.5 4.5l-3 3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      className="animate-spin"
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

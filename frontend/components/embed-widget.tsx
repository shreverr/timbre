"use client";

import {
  RemoteAudioTrack,
  Room,
  RoomEvent,
  Track,
  type LocalParticipant,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from "livekit-client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { EmbedTheme } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

type CallState =
  | "idle"
  | "connecting"
  | "waiting"
  | "live"
  | "ended"
  | "error";

type Role = "user" | "agent";

type Segment = {
  id: string;
  role: Role;
  text: string;
  final: boolean;
};

const DEFAULT_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path d="M5 4.5c.7-1.4 2.3-2.2 3.8-2l.6.1c.7.1 1.3.7 1.4 1.4l.4 2c.1.6-.1 1.2-.6 1.6l-1 .8c.9 1.7 2.3 3.1 4 4l.8-1c.4-.5 1-.7 1.6-.6l2 .4c.7.1 1.3.7 1.4 1.4l.1.6c.2 1.5-.6 3.1-2 3.8-4.4 1.8-9.5-.6-11.3-5C4.4 7.7 4.5 5.7 5 4.5z" fill="currentColor"/></svg>`;

function postParent(message: object) {
  if (typeof window === "undefined") return;
  if (window.parent === window) return;
  try {
    window.parent.postMessage({ source: "timbre-embed", ...message }, "*");
  } catch {
    // ignore — parent origin may have blocked
  }
}

export function EmbedWidget({ publicKey }: { publicKey: string }) {
  const [theme, setTheme] = useState<EmbedTheme | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<CallState>("idle");
  const [callError, setCallError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [seconds, setSeconds] = useState(0);

  // Parent origin — the host site that embedded the iframe. The loader script
  // passes it via ?parent=. Falls back to document.referrer (also parent-set)
  // and finally to window.location.origin so direct visits to /embed/[pk]
  // still work for testing.
  const parentOrigin = useMemo(() => {
    if (typeof window === "undefined") return "";
    try {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get("parent");
      if (fromQuery) return fromQuery;
      if (document.referrer) {
        const u = new URL(document.referrer);
        return `${u.protocol}//${u.host}`;
      }
    } catch {}
    return window.location.origin;
  }, []);

  const roomRef = useRef<Room | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waitingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch theme on mount.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `${API_URL}/embed/${encodeURIComponent(publicKey)}/config`,
        );
        if (!res.ok) {
          if (!cancelled) setError("This widget is unavailable.");
          return;
        }
        const body = (await res.json()) as { theme: EmbedTheme };
        if (!cancelled) setTheme(body.theme);
      } catch {
        if (!cancelled) setError("Couldn't load the widget.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  // Tell the parent loader our preferred size based on open state. For the
  // closed launcher, size depends on whether it's a circle or a pill (which
  // can be wider than 88px when there's a label).
  useEffect(() => {
    if (!theme) return;
    if (open) {
      postParent({ type: "resize", w: 396, h: 580 });
    } else {
      const isPill = theme.buttonShape === "pill";
      const labelLen = (theme.buttonLabel ?? "").trim().length;
      const w = isPill ? Math.min(360, Math.max(120, 80 + labelLen * 9)) : 88;
      postParent({ type: "resize", w, h: 88 });
    }
  }, [open, theme]);

  // Inform parent of position so it can place the iframe.
  useEffect(() => {
    if (!theme) return;
    postParent({ type: "position", value: theme.position });
  }, [theme]);

  // Timer for elapsed seconds during a live call.
  useEffect(() => {
    if (state !== "live") return;
    durationTimerRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    };
  }, [state]);

  // Auto-scroll transcript.
  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [segments]);

  function cleanupCall() {
    if (waitingTimerRef.current) {
      clearTimeout(waitingTimerRef.current);
      waitingTimerRef.current = null;
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    const room = roomRef.current;
    if (room) {
      room.removeAllListeners();
      try {
        room.unregisterTextStreamHandler("lk.transcription");
      } catch {}
      void room.disconnect();
    }
    roomRef.current = null;
  }

  async function startCall() {
    setSegments([]);
    setSeconds(0);
    setMuted(false);
    setCallError(null);
    setState("connecting");
    try {
      const res = await fetch(`${API_URL}/embed/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey, parentOrigin }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        const msg =
          body?.error === "origin not allowed"
            ? "This site isn't authorised for the widget."
            : body?.error === "concurrent limit reached"
            ? "Too many people are using the widget right now. Please retry shortly."
            : body?.error === "daily quota reached"
            ? "Daily limit reached. Please try again tomorrow."
            : body?.error ?? "Couldn't start the call.";
        throw new Error(msg);
      }
      const { url, token } = (await res.json()) as {
        url: string;
        token: string;
        room: string;
      };

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.on(RoomEvent.ParticipantConnected, () => goLive());
      room.on(RoomEvent.Disconnected, () =>
        setState((p) => (p === "error" ? p : "ended")),
      );
      room.registerTextStreamHandler("lk.transcription", (reader, info) => {
        void handleTranscriptStream(reader, info, room);
      });

      await room.connect(url, token);
      await room.localParticipant.setMicrophoneEnabled(true);

      if (room.remoteParticipants.size > 0) {
        goLive();
      } else {
        setState("waiting");
        waitingTimerRef.current = setTimeout(() => {
          if (state !== "live") {
            setCallError("Agent didn't join in time.");
            setState("error");
          }
        }, 15_000);
      }
    } catch (e) {
      setCallError(e instanceof Error ? e.message : "Connection failed");
      setState("error");
      cleanupCall();
    }
  }

  function onTrackSubscribed(
    track: RemoteTrack,
    _pub: RemoteTrackPublication,
    _participant: RemoteParticipant,
  ) {
    if (track.kind !== Track.Kind.Audio) return;
    const audioTrack = track as RemoteAudioTrack;
    if (audioElRef.current) {
      audioTrack.attach(audioElRef.current);
      void audioElRef.current.play().catch(() => {});
    }
  }

  function goLive() {
    if (waitingTimerRef.current) {
      clearTimeout(waitingTimerRef.current);
      waitingTimerRef.current = null;
    }
    setState("live");
  }

  type TextStreamReader = Parameters<
    Parameters<Room["registerTextStreamHandler"]>[1]
  >[0];
  type ParticipantInfo = Parameters<
    Parameters<Room["registerTextStreamHandler"]>[1]
  >[1];

  async function handleTranscriptStream(
    reader: TextStreamReader,
    info: ParticipantInfo,
    room: Room,
  ) {
    const attrs = (reader.info.attributes ?? {}) as Record<string, string>;
    const segmentId = attrs["lk.segment_id"];
    const isFinal = attrs["lk.transcription_final"] === "true";
    const isTranscription = Boolean(attrs["lk.transcribed_track_id"]);
    if (!isTranscription || !segmentId) return;

    const role: Role =
      info.identity === room.localParticipant.identity ? "user" : "agent";

    if (isFinal) {
      try {
        const text = await reader.readAll();
        upsertSegment({ id: segmentId, role, text, final: true });
      } catch {}
      return;
    }

    upsertSegment({ id: segmentId, role, text: "", final: false });
    let acc = "";
    try {
      for await (const chunk of reader) {
        acc += chunk;
        const snapshot = acc;
        setSegments((prev) =>
          prev.map((s) =>
            s.id === segmentId && !s.final ? { ...s, text: snapshot } : s,
          ),
        );
      }
    } catch {}
  }

  function upsertSegment(seg: Segment) {
    setSegments((prev) => {
      const idx = prev.findIndex((s) => s.id === seg.id);
      if (idx === -1) return [...prev, seg];
      const next = prev.slice();
      next[idx] = { ...prev[idx], ...seg };
      return next;
    });
  }

  async function toggleMute() {
    const room = roomRef.current;
    if (!room) return;
    const p = room.localParticipant as LocalParticipant;
    const next = !muted;
    await p.setMicrophoneEnabled(!next);
    setMuted(next);
  }

  function endCall() {
    cleanupCall();
    setState("ended");
  }

  // Cleanup on unmount.
  useEffect(() => {
    return cleanupCall;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External controls: any element can dispatch `timbre:embed-open` /
  // `timbre:embed-close` on window to drive the widget. Used by the landing
  // page to wire up its hero CTA to the same widget.
  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    function onClose() {
      setOpen(false);
    }
    if (typeof window === "undefined") return;
    window.addEventListener("timbre:embed-open", onOpen);
    window.addEventListener("timbre:embed-close", onClose);
    return () => {
      window.removeEventListener("timbre:embed-open", onOpen);
      window.removeEventListener("timbre:embed-close", onClose);
    };
  }, []);

  const accent = theme?.accentColor ?? "#f59e0b";
  const position = theme?.position ?? "bottom-right";

  // Justify the launcher inside the iframe to match the widget's intended
  // corner so it visually anchors to the host page's edge.
  const launcherJustify =
    position === "bottom-right" || position === "top-right"
      ? "justify-end"
      : "justify-start";
  const launcherAlign =
    position === "top-right" || position === "top-left"
      ? "items-start"
      : "items-end";

  const initial = (theme?.agentName ?? "A").trim()[0]?.toUpperCase() ?? "A";

  const buttonShape = theme?.buttonShape ?? "circle";
  const isPill = buttonShape === "pill";
  const buttonLabel = theme?.buttonLabel?.trim() || "";

  // Sanitize against script tags client-side too even though server already
  // strips them; defensive layering.
  const iconSvg = useMemo(() => {
    if (!theme?.buttonIconSvg) return DEFAULT_ICON;
    if (/<script|on[a-z]+\s*=|javascript:/i.test(theme.buttonIconSvg)) {
      return DEFAULT_ICON;
    }
    return theme.buttonIconSvg;
  }, [theme?.buttonIconSvg]);

  if (error) {
    return null;
  }

  if (!theme) {
    return null;
  }

  if (!theme.enabled) {
    return null;
  }

  // ----- Closed (button only) -----
  if (!open) {
    return (
      <div
        className={`fixed inset-0 flex ${launcherAlign} ${launcherJustify} p-2`}
        style={{ pointerEvents: "none" }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={
            isPill
              ? "pointer-events-auto inline-flex h-12 items-center gap-2 whitespace-nowrap rounded-full px-5 text-sm font-medium shadow-lg shadow-black/20 transition hover:opacity-90"
              : "pointer-events-auto inline-flex size-14 items-center justify-center rounded-full shadow-lg shadow-black/20 transition hover:opacity-90"
          }
          style={{ backgroundColor: accent, color: "#fff" }}
          aria-label={buttonLabel || `Talk to ${theme.agentName}`}
        >
          <span aria-hidden dangerouslySetInnerHTML={{ __html: iconSvg }} />
          {isPill && buttonLabel ? <span>{buttonLabel}</span> : null}
        </button>
      </div>
    );
  }

  // ----- Open (panel) -----
  return (
    <div
      className={`fixed inset-0 flex ${launcherAlign} ${launcherJustify} p-2`}
      style={{ pointerEvents: "auto" }}
    >
      <div
        className="flex w-[360px] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-2xl shadow-black/20"
        style={{ height: "560px" }}
      >
        <header
          className="flex items-center justify-between gap-3 px-4 py-3"
          style={{ background: accent, color: "#fff" }}
        >
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-80">
              Voice agent
            </p>
            <h2 className="truncate text-sm font-medium">
              {theme.agentName}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              if (state === "live" || state === "waiting") cleanupCall();
              setOpen(false);
              setState("idle");
              setSegments([]);
            }}
            aria-label="Close"
            className="rounded-md p-1 transition hover:bg-black/10"
          >
            <CloseIcon />
          </button>
        </header>

        <div ref={transcriptRef} className="flex-1 overflow-y-auto bg-zinc-50 px-4 py-3">
          {state === "idle" ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
              <span
                className="grid size-16 place-items-center rounded-full text-xl font-medium"
                style={{ background: `${accent}22`, color: accent }}
              >
                {initial}
              </span>
              <p className="text-sm text-zinc-700">
                {theme.greetingText ||
                  `Click below to talk to ${theme.agentName}.`}
              </p>
            </div>
          ) : state === "error" ? (
            <p className="py-10 text-center text-sm text-red-500">
              {callError ?? "Something went wrong."}
            </p>
          ) : segments.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <span
                className="grid size-16 place-items-center rounded-full text-xl font-medium"
                style={{ background: `${accent}22`, color: accent }}
              >
                {initial}
              </span>
              <p className="text-xs text-zinc-500">
                {state === "connecting" && "Connecting…"}
                {state === "waiting" && "Waiting for the agent to join…"}
                {state === "live" && "Say something — listening."}
                {state === "ended" && "Call ended."}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {segments.map((s) => (
                <li
                  key={s.id}
                  className={
                    s.role === "user" ? "flex justify-end" : "flex justify-start"
                  }
                >
                  <div
                    className={
                      s.role === "user"
                        ? "max-w-[80%] rounded-lg rounded-tr-sm px-3 py-2 text-sm text-white"
                        : "max-w-[80%] rounded-lg rounded-tl-sm border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                    }
                    style={
                      s.role === "user"
                        ? { background: accent }
                        : undefined
                    }
                  >
                    <p
                      className={s.final ? "whitespace-pre-wrap" : "whitespace-pre-wrap opacity-75"}
                    >
                      {cleanTranscript(s.text, s.final) || (s.final ? "" : "…")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-zinc-200 bg-white px-4 py-3">
          <span className="text-[11px] text-zinc-500">
            {state === "live" ? formatDuration(seconds) : statusLabel(state)}
          </span>
          <div className="flex items-center gap-2">
            {state === "idle" || state === "ended" || state === "error" ? (
              <button
                type="button"
                onClick={startCall}
                className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-white"
                style={{ background: accent }}
              >
                <CallIcon />
                {state === "ended" ? "Call again" : "Start call"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={toggleMute}
                  disabled={state !== "live"}
                  className={
                    muted
                      ? "inline-flex size-9 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 hover:bg-zinc-200 disabled:opacity-50"
                      : "inline-flex size-9 items-center justify-center rounded-md border border-zinc-200 text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                  }
                  aria-label={muted ? "Unmute" : "Mute"}
                >
                  {muted ? <MicOffIcon /> : <MicIcon />}
                </button>
                <button
                  type="button"
                  onClick={endCall}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-red-500 px-3 text-sm font-medium text-white hover:bg-red-600"
                >
                  <EndIcon />
                  End
                </button>
              </>
            )}
          </div>
        </footer>

        <audio ref={audioElRef} autoPlay playsInline />
      </div>
    </div>
  );
}

// Strip SSML / pseudo-XML tags ("<emotion ...>", "<break ...>", "<speed ...>"
// etc.) and inline sound markers ("[laughter]") from a transcript chunk
// before display. The TTS engine consumes those, but the LLM's raw text is
// what flows through the transcript stream.
//
// While the segment is still streaming (`!isFinal`) we also buffer anything
// after a yet-unclosed `<` or `[` so a partial tag never flashes on screen
// before its `>` arrives.
function cleanTranscript(text: string, isFinal: boolean): string {
  let out = text.replace(/<[^>]+>/g, "");
  out = out.replace(/\[(?:laughter|laughs?|sigh|pause)\]/gi, "");

  if (!isFinal) {
    const lastOpen = out.lastIndexOf("<");
    if (lastOpen !== -1) {
      // Only hide if it looks like a tag prefix (letters/whitespace after).
      const tail = out.slice(lastOpen);
      if (/^<[a-zA-Z!\/]?[^>]*$/.test(tail)) {
        out = out.slice(0, lastOpen);
      }
    }
    const lastBracket = out.lastIndexOf("[");
    if (lastBracket !== -1) {
      const tail = out.slice(lastBracket);
      if (/^\[[a-zA-Z]*$/.test(tail)) {
        out = out.slice(0, lastBracket);
      }
    }
  }

  return out.replace(/\s{2,}/g, " ").trimStart();
}

function statusLabel(state: CallState): string {
  if (state === "connecting") return "Connecting…";
  if (state === "waiting") return "Waiting…";
  if (state === "ended") return "Call ended";
  if (state === "error") return "Error";
  return "";
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 3l10 10M13 3L3 13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CallIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <path
        d="M3.2 4.1c.5-1.1 1.7-1.8 2.9-1.6l.5.1c.6.1 1 .6 1.1 1.2l.3 1.6c.1.5-.1 1-.5 1.3l-.8.6c.7 1.4 1.8 2.5 3.2 3.2l.6-.8c.3-.4.8-.6 1.3-.5l1.6.3c.6.1 1 .5 1.2 1.1l.1.5c.2 1.2-.5 2.4-1.6 2.9-3.4 1.4-7.3-.6-8.7-4-.9-2.1-.8-3.7-.2-4.9z"
        fill="currentColor"
      />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="6" y="2" width="4" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 8a4 4 0 0 0 8 0M8 12v2M6 14h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="6" y="2" width="4" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 8a4 4 0 0 0 8 0M8 12v2M6 14h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function EndIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <path
        d="M1.5 9.5c1.7-2 4-3 6.5-3s4.8 1 6.5 3l-.8 1.6c-.2.4-.6.6-1 .5l-1.8-.4a1 1 0 0 1-.8-.9l-.1-1.1a6.5 6.5 0 0 0-4 0l-.1 1.1a1 1 0 0 1-.8.9l-1.8.4c-.4.1-.8-.1-1-.5L1.5 9.5z"
        fill="currentColor"
      />
    </svg>
  );
}

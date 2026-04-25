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
import { useEffect, useRef, useState } from "react";

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

function cleanTranscript(text: string, isFinal: boolean): string {
  let out = text.replace(/<[^>]+>/g, "");
  out = out.replace(/\[(?:laughter|laughs?|sigh|pause)\]/gi, "");
  if (!isFinal) {
    const lastOpen = out.lastIndexOf("<");
    if (lastOpen !== -1) {
      const tail = out.slice(lastOpen);
      if (/^<[a-zA-Z!\/]?[^>]*$/.test(tail)) out = out.slice(0, lastOpen);
    }
    const lastBracket = out.lastIndexOf("[");
    if (lastBracket !== -1) {
      const tail = out.slice(lastBracket);
      if (/^\[[a-zA-Z]*$/.test(tail)) out = out.slice(0, lastBracket);
    }
  }
  return out.replace(/\s{2,}/g, " ").trimStart();
}

/**
 * Self-contained landing-page call UI. Hits the public `/demo/token` endpoint
 * — no signup, no embed config required. Listens for `timbre:demo-open` so
 * any CTA on the page can open the modal.
 */
export function LandingCall() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<CallState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [agentName, setAgentName] = useState<string>("Timbre");

  const roomRef = useRef<Room | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const waitingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // External trigger.
  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("timbre:demo-open", onOpen);
    return () => window.removeEventListener("timbre:demo-open", onOpen);
  }, []);

  // Auto-start the call when the modal opens.
  useEffect(() => {
    if (!open) return;
    if (state !== "idle" && state !== "ended" && state !== "error") return;
    void startCall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Duration timer.
  useEffect(() => {
    if (state !== "live") return;
    durationTimerRef.current = setInterval(
      () => setSeconds((s) => s + 1),
      1000,
    );
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

  function cleanup() {
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
    setError(null);
    setState("connecting");

    try {
      const res = await fetch(`${API_URL}/demo/token`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        const msg =
          body?.error === "demo_unavailable"
            ? "The demo agent isn't configured yet."
            : body?.error === "demo_voice_missing"
            ? "The demo agent has no voice picked yet."
            : body?.error === "concurrent_limit"
            ? "Too many calls from your network right now. Please retry shortly."
            : body?.error === "hourly_limit"
            ? "Hourly demo limit reached. Please try again later."
            : body?.error ?? "Couldn't start the demo.";
        throw new Error(msg);
      }
      const { url, token, agentName: name } = (await res.json()) as {
        url: string;
        token: string;
        room: string;
        agentName: string;
      };
      setAgentName(name || "Timbre");

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
          setState((p) => (p === "live" ? p : "error"));
          setError("The agent didn't pick up. Try again in a moment.");
        }, 15_000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
      setState("error");
      cleanup();
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
    cleanup();
    setState("ended");
  }

  function close() {
    cleanup();
    setState("idle");
    setSegments([]);
    setOpen(false);
  }

  // Cleanup on unmount.
  useEffect(() => cleanup, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="mx-4 flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl shadow-black/60">
        <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-accent">
              Live demo
            </p>
            <h2 className="mt-0.5 truncate text-sm font-medium">
              {agentName}
            </h2>
          </div>
          <StatusPill state={state} seconds={seconds} />
        </header>

        <div
          ref={transcriptRef}
          className="flex-1 min-h-[300px] overflow-y-auto px-5 py-4"
        >
          {state === "error" ? (
            <p className="py-12 text-center text-sm text-red-400">
              {error ?? "Call failed."}
            </p>
          ) : segments.length === 0 ? (
            <EmptyState state={state} name={agentName} />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {segments.map((s) => (
                <li
                  key={s.id}
                  className={
                    s.role === "user"
                      ? "flex justify-end"
                      : "flex justify-start"
                  }
                >
                  <div
                    className={
                      s.role === "user"
                        ? "max-w-[80%] rounded-lg rounded-tr-sm bg-foreground/90 px-3 py-2 text-sm text-background"
                        : "max-w-[80%] rounded-lg rounded-tl-sm border border-border bg-background px-3 py-2 text-sm text-foreground"
                    }
                  >
                    <div className="mb-0.5 text-[10px] uppercase tracking-wider opacity-60">
                      {s.role === "user" ? "You" : agentName}
                    </div>
                    <p
                      className={
                        s.final
                          ? "whitespace-pre-wrap"
                          : "whitespace-pre-wrap opacity-75"
                      }
                    >
                      {cleanTranscript(s.text, s.final) ||
                        (s.final ? "" : "…")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-center gap-3 border-t border-border bg-surface/80 px-5 py-4">
          {state === "error" || state === "ended" ? (
            <>
              <button
                type="button"
                onClick={close}
                className="inline-flex h-10 items-center rounded-md border border-border-strong px-4 text-sm transition hover:bg-surface-2"
              >
                Close
              </button>
              {state === "ended" ? (
                <button
                  type="button"
                  onClick={() => void startCall()}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-background transition hover:bg-accent-soft"
                >
                  Call again
                </button>
              ) : null}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleMute}
                disabled={state !== "live"}
                className={
                  muted
                    ? "inline-flex h-10 items-center gap-2 rounded-md bg-surface-2 px-4 text-sm font-medium text-foreground disabled:opacity-50"
                    : "inline-flex h-10 items-center gap-2 rounded-md border border-border-strong px-4 text-sm font-medium text-foreground transition hover:bg-surface-2 disabled:opacity-50"
                }
              >
                {muted ? "Unmute" : "Mute"}
              </button>
              <button
                type="button"
                onClick={endCall}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-red-500/15 px-4 text-sm font-medium text-red-300 transition hover:bg-red-500/25"
              >
                End call
              </button>
            </>
          )}
        </footer>

        <audio ref={audioElRef} autoPlay playsInline />
      </div>
    </div>
  );
}

function EmptyState({ state, name }: { state: CallState; name: string }) {
  const initial = name.trim()[0]?.toUpperCase() ?? "T";
  const active = state === "live";
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 py-12">
      <div className="relative grid size-20 place-items-center">
        {active ? (
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
        ) : null}
        <span
          className={
            active
              ? "relative grid size-16 place-items-center rounded-full bg-accent/15 text-xl font-medium text-accent ring-1 ring-accent/40"
              : "relative grid size-16 place-items-center rounded-full bg-surface-2 text-xl font-medium text-muted ring-1 ring-border"
          }
        >
          {initial}
        </span>
      </div>
      <p className="text-center text-xs text-muted">
        {state === "connecting" && "Connecting…"}
        {state === "waiting" && "Waiting for the agent to join…"}
        {state === "live" && "Say something — I'm listening."}
        {state === "ended" && "Call ended."}
        {state === "idle" && "Tap below to start."}
      </p>
    </div>
  );
}

function StatusPill({
  state,
  seconds,
}: {
  state: CallState;
  seconds: number;
}) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");

  if (state === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
        </span>
        Live · {m}:{s}
      </span>
    );
  }
  if (state === "connecting" || state === "waiting") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
        <span className="inline-block size-1.5 animate-pulse rounded-full bg-muted-2" />
        {state === "connecting" ? "Connecting…" : "Waiting…"}
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-400">
        <span className="inline-block size-1.5 rounded-full bg-red-400" />
        Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-2">
      <span className="inline-block size-1.5 rounded-full bg-muted-2" />
      Ended
    </span>
  );
}

export function LandingCallTrigger({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(new CustomEvent("timbre:demo-open"))
      }
      className={className}
    >
      {children}
    </button>
  );
}

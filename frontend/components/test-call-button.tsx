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
import { apiFetch } from "@/lib/api";
import type { Agent } from "@/lib/types";

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

export function TestCallButton({ agent }: { agent: Agent }) {
  const [open, setOpen] = useState(false);
  const disabled = agent.voiceId == null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!disabled) setOpen(true);
        }}
        disabled={disabled}
        title={disabled ? "Select a voice first" : undefined}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-medium text-background transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        <PhoneIcon />
        Test call
      </button>
      {open ? (
        <TestCallModal agent={agent} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function TestCallModal({
  agent,
  onClose,
}: {
  agent: Agent;
  onClose: () => void;
}) {
  const [state, setState] = useState<CallState>("connecting");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [segments, setSegments] = useState<Segment[]>([]);

  const roomRef = useRef<Room | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const waitingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const agentJoinedRef = useRef(false);

  useEffect(() => {
    let disposed = false;

    async function connect() {
      try {
        const res = await apiFetch(`/agents/${agent.id}/test-call`, {
          method: "POST",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? "Failed to start test call");
        }
        const { url, token } = (await res.json()) as {
          url: string;
          token: string;
          roomName: string;
        };
        if (disposed) return;

        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
        room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
        room.on(RoomEvent.Disconnected, onRoomDisconnected);

        // Live transcripts via the lk.transcription text stream topic.
        room.registerTextStreamHandler("lk.transcription", (reader, info) => {
          void handleTranscriptStream(reader, info, room);
        });

        await room.connect(url, token);
        if (disposed) return;

        await room.localParticipant.setMicrophoneEnabled(true);
        if (disposed) return;

        if (room.remoteParticipants.size > 0) {
          goLive();
        } else {
          setState("waiting");
          waitingTimerRef.current = setTimeout(() => {
            if (!disposed && !agentJoinedRef.current) {
              setErrorMsg(
                "Agent didn't join. Make sure `cd agent && uv run python src/agent.py dev` is running.",
              );
              setState("error");
            }
          }, 15_000);
        }
      } catch (e) {
        if (disposed) return;
        setErrorMsg(e instanceof Error ? e.message : "Connection failed");
        setState("error");
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

    function onParticipantConnected() {
      goLive();
    }

    function onRoomDisconnected() {
      setState((prev) => (prev === "error" ? prev : "ended"));
    }

    function goLive() {
      agentJoinedRef.current = true;
      setState("live");
      if (waitingTimerRef.current) {
        clearTimeout(waitingTimerRef.current);
        waitingTimerRef.current = null;
      }
      if (!durationTimerRef.current) {
        durationTimerRef.current = setInterval(() => {
          setSeconds((s) => s + 1);
        }, 1000);
      }
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
        } catch {
          // Stream aborted; ignore.
        }
        return;
      }

      // Interim stream: upsert empty segment, append chunks as they arrive.
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
      } catch {
        // Stream aborted; ignore.
      }
    }

    function upsertSegment(seg: Segment) {
      setSegments((prev) => {
        const idx = prev.findIndex((s) => s.id === seg.id);
        if (idx === -1) return [...prev, seg];
        const next = prev.slice();
        // Keep the latest text; final version wins over interim.
        next[idx] = { ...prev[idx], ...seg };
        return next;
      });
    }

    void connect();

    return () => {
      disposed = true;
      if (waitingTimerRef.current) clearTimeout(waitingTimerRef.current);
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      const room = roomRef.current;
      if (room) {
        room.removeAllListeners();
        try {
          room.unregisterTextStreamHandler("lk.transcription");
        } catch {}
        void room.disconnect();
      }
      roomRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id]);

  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [segments]);

  async function toggleMute() {
    const room = roomRef.current;
    if (!room) return;
    const p = room.localParticipant as LocalParticipant;
    const next = !muted;
    await p.setMicrophoneEnabled(!next);
    setMuted(next);
  }

  function end() {
    const room = roomRef.current;
    if (room) void room.disconnect();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) end();
      }}
    >
      <div className="mx-4 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-2xl shadow-black/60">
        <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-accent">
              Test call
            </p>
            <h2 className="mt-0.5 text-sm font-medium">{agent.name}</h2>
          </div>
          <StatusPill state={state} seconds={seconds} />
        </header>

        <div
          ref={transcriptRef}
          className="flex-1 min-h-[260px] overflow-y-auto px-5 py-4"
        >
          {state === "error" ? (
            <p className="py-10 text-center text-sm text-red-400">
              {errorMsg ?? "Call failed."}
            </p>
          ) : segments.length === 0 ? (
            <EmptyState state={state} name={agent.name} />
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
                      {s.role === "user" ? "You" : "Agent"}
                    </div>
                    <p
                      className={
                        s.final ? "whitespace-pre-wrap" : "whitespace-pre-wrap opacity-75"
                      }
                    >
                      {cleanTranscript(s.text, s.final) || (s.final ? "" : "…")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-center gap-3 border-t border-border bg-surface/80 px-5 py-4">
          {state === "error" ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-md border border-border-strong px-4 text-sm transition hover:bg-surface-2"
            >
              Close
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleMute}
                disabled={state !== "live"}
                className={
                  muted
                    ? "inline-flex h-10 items-center gap-2 rounded-md bg-surface-2 px-4 text-sm font-medium text-foreground transition hover:bg-accent/20 disabled:opacity-50"
                    : "inline-flex h-10 items-center gap-2 rounded-md border border-border-strong px-4 text-sm font-medium text-foreground transition hover:bg-surface-2 disabled:opacity-50"
                }
              >
                {muted ? <MicOffIcon /> : <MicIcon />}
                {muted ? "Unmute" : "Mute"}
              </button>
              <button
                type="button"
                onClick={end}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-red-500/15 px-4 text-sm font-medium text-red-300 transition hover:bg-red-500/25"
              >
                <EndIcon />
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

// Strip SSML / pseudo-XML tags and inline sound markers from raw transcript
// text. The TTS consumes these tags but the raw LLM output is what flows
// through LiveKit's transcript stream.
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

function EmptyState({ state, name }: { state: CallState; name: string }) {
  const initial = name.trim()[0]?.toUpperCase() ?? "A";
  const active = state === "live";
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 py-10">
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
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
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

function PhoneIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.2 4.1c.5-1.1 1.7-1.8 2.9-1.6l.5.1c.6.1 1 .6 1.1 1.2l.3 1.6c.1.5-.1 1-.5 1.3l-.8.6c.7 1.4 1.8 2.5 3.2 3.2l.6-.8c.3-.4.8-.6 1.3-.5l1.6.3c.6.1 1 .5 1.2 1.1l.1.5c.2 1.2-.5 2.4-1.6 2.9-3.4 1.4-7.3-.6-8.7-4-.9-2.1-.8-3.7-.2-4.9z"
        fill="currentColor"
      />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="6"
        y="2"
        width="4"
        height="8"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M4 8a4 4 0 0 0 8 0M8 12v2M6 14h4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="6"
        y="2"
        width="4"
        height="8"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M4 8a4 4 0 0 0 8 0M8 12v2M6 14h4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M2 2l12 12"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EndIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M1.5 9.5c1.7-2 4-3 6.5-3s4.8 1 6.5 3l-.8 1.6c-.2.4-.6.6-1 .5l-1.8-.4a1 1 0 0 1-.8-.9l-.1-1.1a6.5 6.5 0 0 0-4 0l-.1 1.1a1 1 0 0 1-.8.9l-1.8.4c-.4.1-.8-.1-1-.5L1.5 9.5z"
        fill="currentColor"
      />
    </svg>
  );
}

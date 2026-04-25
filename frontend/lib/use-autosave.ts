"use client";

import { useEffect, useRef, useState } from "react";

export type AutosaveStatus =
  | "idle"
  | "pending"
  | "saving"
  | "saved"
  | "error";

type UseAutosaveArgs<T> = {
  /** Current (potentially-dirty) value from local state. */
  value: T;
  /** The server-persisted baseline; when `value` equals this, no save runs. */
  baseline: T;
  /** Async save function; receives the latest value. */
  save: (value: T) => Promise<void>;
  /** Debounce in ms. Default 800. */
  delay?: number;
  /**
   * Shallow equality check. Default is `Object.is`, which works for primitives
   * but not for object-shaped values — pass a shallow comparator for those.
   */
  isEqual?: (a: T, b: T) => boolean;
  /** Sync validator. Return an error string to block the save (status goes to "error"). */
  validate?: (value: T) => string | null;
};

export function useAutosave<T>({
  value,
  baseline,
  save,
  delay = 800,
  isEqual = Object.is,
  validate,
}: UseAutosaveArgs<T>) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Ref pattern: keep latest callbacks without re-triggering the save effect.
  const saveRef = useRef(save);
  const isEqualRef = useRef(isEqual);
  const validateRef = useRef(validate);
  const saveIdRef = useRef(0);

  useEffect(() => {
    saveRef.current = save;
    isEqualRef.current = isEqual;
    validateRef.current = validate;
  });

  // Auto-decay "saved" → "idle" after 2s so the badge doesn't linger forever.
  useEffect(() => {
    if (status !== "saved") return;
    const t = setTimeout(() => setStatus("idle"), 2000);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    if (isEqualRef.current(value, baseline)) return;

    const validation = validateRef.current?.(value) ?? null;
    if (validation) {
      setError(validation);
      setStatus("error");
      return;
    }

    setStatus("pending");
    const timer = setTimeout(async () => {
      const myId = ++saveIdRef.current;
      setStatus("saving");
      try {
        await saveRef.current(value);
        if (saveIdRef.current === myId) {
          setError(null);
          setStatus("saved");
        }
      } catch (e) {
        if (saveIdRef.current === myId) {
          setError(e instanceof Error ? e.message : "Save failed");
          setStatus("error");
        }
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [value, baseline, delay]);

  return { status, error };
}

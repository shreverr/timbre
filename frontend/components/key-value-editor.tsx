"use client";

type Pair = { key: string; value: string };

export function KeyValueEditor({
  pairs,
  onChange,
  keyPlaceholder = "Header name",
  valuePlaceholder = "Header value",
}: {
  pairs: Pair[];
  onChange: (next: Pair[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  function update(i: number, patch: Partial<Pair>) {
    onChange(pairs.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function remove(i: number) {
    onChange(pairs.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...pairs, { key: "", value: "" }]);
  }

  return (
    <div className="flex flex-col gap-2">
      {pairs.map((p, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={p.key}
            onChange={(e) => update(i, { key: e.target.value })}
            placeholder={keyPlaceholder}
            className="h-9 flex-1 rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-border-strong"
          />
          <input
            value={p.value}
            onChange={(e) => update(i, { value: e.target.value })}
            placeholder={valuePlaceholder}
            className="h-9 flex-[2] rounded-md border border-border bg-background px-2.5 font-mono text-xs outline-none focus:border-border-strong"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="inline-flex h-9 items-center rounded-md px-2 text-xs text-muted hover:text-red-400"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="self-start text-xs text-accent hover:underline"
      >
        + Add row
      </button>
    </div>
  );
}

export function pairsToRecord(pairs: Pair[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of pairs) {
    if (p.key.trim()) out[p.key.trim()] = p.value;
  }
  return out;
}

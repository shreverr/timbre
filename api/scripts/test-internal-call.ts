/**
 * Quick smoke test for POST /internal/calls.
 *
 * Usage:
 *   cd api
 *   bun run scripts/test-internal-call.ts <agentId>
 *
 * Reads INTERNAL_API_KEY + PORT from .env. Prints status + body.
 */

import "dotenv/config";

const agentId = process.argv[2];
if (!agentId) {
  console.error("usage: bun run scripts/test-internal-call.ts <agentId>");
  process.exit(2);
}

const port = process.env.PORT ?? "8787";
const key = process.env.INTERNAL_API_KEY;
if (!key) {
  console.error("INTERNAL_API_KEY not set in env");
  process.exit(2);
}

const now = new Date();
const earlier = new Date(now.getTime() - 30_000);

const res = await fetch(`http://localhost:${port}/internal/calls`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    agentId,
    mode: "test",
    room: `manual-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: earlier.toISOString(),
    endedAt: now.toISOString(),
    durationSeconds: 30,
    transcript: [
      { role: "user", text: "hello, this is a manual smoke test" },
      { role: "agent", text: "received and logged from the script" },
    ],
  }),
});

console.log("status:", res.status);
console.log("body:", await res.text());

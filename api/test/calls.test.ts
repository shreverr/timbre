import { beforeEach, describe, expect, test } from "bun:test";
import {
  getCallLogStore,
  resetFakeDb,
  seedAgent,
  seedCallLog,
} from "./mocks/db.mock";
import { resetLivekitMock } from "./mocks/livekit.mock";
import { authedFetch, buildApp, USER_A, USER_B } from "./helpers";

const app = buildApp();
const INTERNAL_KEY = "test-internal-key-1234567890";

beforeEach(() => {
  resetFakeDb();
  resetLivekitMock();
});

function internalCallWrite(body: unknown, key = INTERNAL_KEY) {
  return app.request("/internal/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("Internal POST /internal/calls", () => {
  test("happy path inserts a row scoped to agent owner", async () => {
    const a = seedAgent({ userId: USER_A });
    const res = await internalCallWrite({
      agentId: a.id,
      mode: "test",
      room: "test-room-1",
      startedAt: "2026-04-25T10:00:00.000Z",
      endedAt: "2026-04-25T10:00:30.000Z",
      durationSeconds: 30,
      transcript: [
        { role: "user", text: "hi" },
        { role: "agent", text: "hello there" },
      ],
    });
    expect(res.status).toBe(201);
    const stored = getCallLogStore();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.userId).toBe(USER_A);
    expect(stored[0]?.agentId).toBe(a.id);
  });

  test("rejects with bad bearer token", async () => {
    const a = seedAgent({ userId: USER_A });
    const res = await internalCallWrite(
      {
        agentId: a.id,
        mode: "test",
        room: "r",
        startedAt: "2026-04-25T10:00:00.000Z",
        endedAt: "2026-04-25T10:00:01.000Z",
        durationSeconds: 1,
        transcript: [],
      },
      "wrong-key",
    );
    expect(res.status).toBe(401);
  });

  test("returns 404 when agentId doesn't exist", async () => {
    const res = await internalCallWrite({
      agentId: crypto.randomUUID(),
      mode: "test",
      room: "r",
      startedAt: "2026-04-25T10:00:00.000Z",
      endedAt: "2026-04-25T10:00:01.000Z",
      durationSeconds: 1,
      transcript: [],
    });
    expect(res.status).toBe(404);
  });

  test("rejects malformed body", async () => {
    const res = await internalCallWrite({ agentId: "not-uuid" });
    expect(res.status).toBe(400);
  });
});

describe("GET /calls (list)", () => {
  test("returns calls scoped to user, sorted by startedAt desc", async () => {
    const a = seedAgent({ userId: USER_A });
    seedCallLog({
      userId: USER_A,
      agentId: a.id,
      mode: "test",
      startedAt: new Date("2026-04-24T10:00:00Z"),
      endedAt: new Date("2026-04-24T10:01:00Z"),
      durationSeconds: 60,
    });
    seedCallLog({
      userId: USER_A,
      agentId: a.id,
      mode: "embed",
      startedAt: new Date("2026-04-25T10:00:00Z"),
      endedAt: new Date("2026-04-25T10:01:30Z"),
      durationSeconds: 90,
    });
    // Other user's call — must not leak.
    const otherAgent = seedAgent({ userId: USER_B });
    seedCallLog({ userId: USER_B, agentId: otherAgent.id });

    const res = await authedFetch(app, "/calls", USER_A);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      calls: Array<{ mode: string; messageCount: number }>;
    };
    expect(body.calls).toHaveLength(2);
    expect(body.calls[0]?.mode).toBe("embed");
    expect(body.calls[1]?.mode).toBe("test");
    expect(body.calls[0]?.messageCount).toBe(2);
  });

  test("?agentId= filters", async () => {
    const a1 = seedAgent({ userId: USER_A });
    const a2 = seedAgent({ userId: USER_A });
    seedCallLog({ userId: USER_A, agentId: a1.id });
    seedCallLog({ userId: USER_A, agentId: a2.id });

    const res = await authedFetch(app, `/calls?agentId=${a1.id}`, USER_A);
    const body = (await res.json()) as {
      calls: Array<{ agentId: string }>;
    };
    expect(body.calls).toHaveLength(1);
    expect(body.calls[0]?.agentId).toBe(a1.id);
  });

  test("list endpoint omits transcript bodies", async () => {
    const a = seedAgent({ userId: USER_A });
    seedCallLog({
      userId: USER_A,
      agentId: a.id,
      transcript: JSON.stringify([{ role: "user", text: "secret" }]),
    });
    const res = await authedFetch(app, "/calls", USER_A);
    const text = await res.text();
    expect(text).not.toContain("secret");
  });

  test("requires auth", async () => {
    const res = await app.request("/calls");
    expect(res.status).toBe(401);
  });
});

describe("GET /calls/:id (detail)", () => {
  test("returns transcript for owner", async () => {
    const a = seedAgent({ userId: USER_A });
    const c = seedCallLog({
      userId: USER_A,
      agentId: a.id,
      transcript: JSON.stringify([
        { role: "user", text: "hi" },
        { role: "agent", text: "hello" },
      ]),
    });
    const res = await authedFetch(app, `/calls/${c.id}`, USER_A);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      call: { transcript: Array<{ role: string; text: string }> };
    };
    expect(body.call.transcript).toHaveLength(2);
    expect(body.call.transcript[1]?.text).toBe("hello");
  });

  test("404 for cross-user access", async () => {
    const a = seedAgent({ userId: USER_A });
    const c = seedCallLog({ userId: USER_A, agentId: a.id });
    const res = await authedFetch(app, `/calls/${c.id}`, USER_B);
    expect(res.status).toBe(404);
  });
});

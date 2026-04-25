import { beforeEach, describe, expect, test } from "bun:test";
import {
  resetFakeDb,
  seedAgent,
  type FakeAgent,
} from "./mocks/db.mock";
import { getDispatches, resetLivekitMock } from "./mocks/livekit.mock";
import { authedFetch, buildApp, USER_A, USER_B } from "./helpers";

const app = buildApp();

beforeEach(() => {
  resetFakeDb();
  resetLivekitMock();
});

describe("POST /agents (validation)", () => {
  test("empty name → 400", async () => {
    const res = await authedFetch(app, "/agents", USER_A, {
      method: "POST",
      body: JSON.stringify({ name: "   " }),
    });
    expect(res.status).toBe(400);
  });

  test("name over 100 chars → 400", async () => {
    const res = await authedFetch(app, "/agents", USER_A, {
      method: "POST",
      body: JSON.stringify({ name: "x".repeat(101) }),
    });
    expect(res.status).toBe(400);
  });

  test("invalid type → 400", async () => {
    const res = await authedFetch(app, "/agents", USER_A, {
      method: "POST",
      body: JSON.stringify({ name: "bot", type: "OTHER" }),
    });
    expect(res.status).toBe(400);
  });

  test("invalid language → 400", async () => {
    const res = await authedFetch(app, "/agents", USER_A, {
      method: "POST",
      body: JSON.stringify({ name: "bot", language: "english" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /agents (success)", () => {
  test("creates agent with defaults", async () => {
    const res = await authedFetch(app, "/agents", USER_A, {
      method: "POST",
      body: JSON.stringify({ name: "support-bot" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { agent: FakeAgent };
    expect(body.agent.name).toBe("support-bot");
    expect(body.agent.type).toBe("SINGLE");
    expect(body.agent.language).toBe("multi");
    expect(body.agent.userId).toBe(USER_A);
    expect(body.agent.voiceId).toBeNull();
  });

  test("accepts type and language override", async () => {
    const res = await authedFetch(app, "/agents", USER_A, {
      method: "POST",
      body: JSON.stringify({
        name: "sales-bot",
        type: "SINGLE",
        language: "hi",
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { agent: FakeAgent };
    expect(body.agent.language).toBe("hi");
  });
});

describe("GET /agents", () => {
  test("returns only the caller's agents", async () => {
    seedAgent({ userId: USER_A, name: "a1" });
    seedAgent({ userId: USER_A, name: "a2" });
    seedAgent({ userId: USER_B, name: "b1" });

    const res = await authedFetch(app, "/agents", USER_A);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { agents: FakeAgent[] };
    expect(body.agents).toHaveLength(2);
    expect(body.agents.every((a) => a.userId === USER_A)).toBe(true);
  });

  test("newest first", async () => {
    seedAgent({
      userId: USER_A,
      name: "old",
      createdAt: new Date("2026-01-01"),
    });
    seedAgent({
      userId: USER_A,
      name: "new",
      createdAt: new Date("2026-04-01"),
    });
    const res = await authedFetch(app, "/agents", USER_A);
    const body = (await res.json()) as { agents: FakeAgent[] };
    expect(body.agents[0]?.name).toBe("new");
    expect(body.agents[1]?.name).toBe("old");
  });
});

describe("GET /agents/:id", () => {
  test("owner gets 200", async () => {
    const a = seedAgent({ userId: USER_A, name: "mine" });
    const res = await authedFetch(app, `/agents/${a.id}`, USER_A);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { agent: FakeAgent };
    expect(body.agent.id).toBe(a.id);
  });

  test("non-owner gets 404", async () => {
    const a = seedAgent({ userId: USER_A });
    const res = await authedFetch(app, `/agents/${a.id}`, USER_B);
    expect(res.status).toBe(404);
  });
});

describe("PATCH /agents/:id", () => {
  test("no fields → 400", async () => {
    const a = seedAgent({ userId: USER_A });
    const res = await authedFetch(app, `/agents/${a.id}`, USER_A, {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  test("updates only provided fields", async () => {
    const a = seedAgent({
      userId: USER_A,
      name: "before",
      voiceId: "voice-1",
      firstMessage: "hello",
    });
    const res = await authedFetch(app, `/agents/${a.id}`, USER_A, {
      method: "PATCH",
      body: JSON.stringify({ name: "after" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { agent: FakeAgent };
    expect(body.agent.name).toBe("after");
    expect(body.agent.voiceId).toBe("voice-1");
    expect(body.agent.firstMessage).toBe("hello");
  });

  test("can null out voiceId", async () => {
    const a = seedAgent({ userId: USER_A, voiceId: "voice-1" });
    const res = await authedFetch(app, `/agents/${a.id}`, USER_A, {
      method: "PATCH",
      body: JSON.stringify({ voiceId: null }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { agent: FakeAgent };
    expect(body.agent.voiceId).toBeNull();
  });

  test("non-owner gets 404", async () => {
    const a = seedAgent({ userId: USER_A });
    const res = await authedFetch(app, `/agents/${a.id}`, USER_B, {
      method: "PATCH",
      body: JSON.stringify({ name: "hijack" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /agents/:id", () => {
  test("owner deletes successfully", async () => {
    const a = seedAgent({ userId: USER_A });
    const res = await authedFetch(app, `/agents/${a.id}`, USER_A, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("non-owner gets 404 and row survives", async () => {
    const a = seedAgent({ userId: USER_A });
    const res = await authedFetch(app, `/agents/${a.id}`, USER_B, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);

    // Row should still be accessible to its owner.
    const check = await authedFetch(app, `/agents/${a.id}`, USER_A);
    expect(check.status).toBe(200);
  });
});

describe("POST /agents/:id/test-call", () => {
  test("400 when agent has no voice", async () => {
    const a = seedAgent({ userId: USER_A, voiceId: null });
    const res = await authedFetch(app, `/agents/${a.id}/test-call`, USER_A, {
      method: "POST",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/voice/i);
  });

  test("404 when agent belongs to another user", async () => {
    const a = seedAgent({ userId: USER_A, voiceId: "voice-1" });
    const res = await authedFetch(app, `/agents/${a.id}/test-call`, USER_B, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });

  test("200 returns url+token+roomName and dispatches agent with metadata", async () => {
    const a = seedAgent({
      userId: USER_A,
      name: "live",
      voiceId: "voice-1",
      language: "en",
      firstMessage: "hi there",
      objective: "qualify leads",
    });
    const res = await authedFetch(app, `/agents/${a.id}/test-call`, USER_A, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      url: string;
      token: string;
      roomName: string;
    };
    expect(body.url).toBe("ws://placeholder.livekit");
    expect(body.token).toBe(`test-token-for-${USER_A}`);
    expect(body.roomName).toStartWith(`test-${a.id}-`);

    const dispatches = getDispatches();
    expect(dispatches).toHaveLength(1);
    expect(dispatches[0]?.roomName).toBe(body.roomName);
    expect(dispatches[0]?.agentName).toBe("agent");
    const meta = JSON.parse(dispatches[0]?.metadata ?? "{}");
    expect(meta).toMatchObject({
      agentId: a.id,
      voiceId: "voice-1",
      language: "en",
      firstMessage: "hi there",
      objective: "qualify leads",
    });
  });
});

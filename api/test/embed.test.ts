import { beforeEach, describe, expect, test } from "bun:test";
import {
  getEmbedCallStore,
  getEmbedConfigStore,
  resetFakeDb,
  seedAgent,
  seedEmbedCall,
  seedEmbedConfig,
} from "./mocks/db.mock";
import { resetLivekitMock } from "./mocks/livekit.mock";
import { authedFetch, buildApp, USER_A, USER_B } from "./helpers";

const app = buildApp();

beforeEach(() => {
  resetFakeDb();
  resetLivekitMock();
});

// --------------------------------------------------------------------------
// Admin endpoints
// --------------------------------------------------------------------------

describe("Embed admin CRUD", () => {
  test("POST /agents/:id/embed creates a config with public key + defaults", async () => {
    const a = seedAgent({ userId: USER_A });
    const res = await authedFetch(app, `/agents/${a.id}/embed`, USER_A, {
      method: "POST",
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      embed: { publicKey: string; allowedOrigins: string[]; enabled: boolean };
    };
    expect(body.embed.publicKey.startsWith("pk_")).toBe(true);
    expect(body.embed.allowedOrigins).toEqual([]);
    expect(body.embed.enabled).toBe(true);
    expect(getEmbedConfigStore()).toHaveLength(1);
  });

  test("POST is idempotent — second call returns existing config", async () => {
    const a = seedAgent({ userId: USER_A });
    const first = await authedFetch(app, `/agents/${a.id}/embed`, USER_A, {
      method: "POST",
    });
    const firstBody = (await first.json()) as { embed: { publicKey: string } };

    const second = await authedFetch(app, `/agents/${a.id}/embed`, USER_A, {
      method: "POST",
    });
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as {
      embed: { publicKey: string };
    };
    expect(secondBody.embed.publicKey).toBe(firstBody.embed.publicKey);
    expect(getEmbedConfigStore()).toHaveLength(1);
  });

  test("GET returns 404 when no config", async () => {
    const a = seedAgent({ userId: USER_A });
    const res = await authedFetch(app, `/agents/${a.id}/embed`, USER_A);
    expect(res.status).toBe(404);
  });

  test("GET returns config", async () => {
    const a = seedAgent({ userId: USER_A });
    seedEmbedConfig({ userId: USER_A, agentId: a.id });
    const res = await authedFetch(app, `/agents/${a.id}/embed`, USER_A);
    expect(res.status).toBe(200);
  });

  test("Cross-user POST → 404", async () => {
    const a = seedAgent({ userId: USER_A });
    const res = await authedFetch(app, `/agents/${a.id}/embed`, USER_B, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });

  test("PATCH updates allowedOrigins, theme, limits", async () => {
    const a = seedAgent({ userId: USER_A });
    seedEmbedConfig({ userId: USER_A, agentId: a.id });
    const res = await authedFetch(app, `/agents/${a.id}/embed`, USER_A, {
      method: "PATCH",
      body: JSON.stringify({
        allowedOrigins: ["https://acme.com", "https://www.acme.com"],
        accentColor: "#ff0000",
        buttonShape: "pill",
        buttonLabel: "Talk to AI",
        position: "bottom-left",
        maxConcurrent: 3,
        dailyCallQuota: 50,
      }),
    });
    expect(res.status).toBe(200);
    const stored = getEmbedConfigStore()[0]!;
    expect(JSON.parse(stored.allowedOrigins)).toEqual([
      "https://acme.com",
      "https://www.acme.com",
    ]);
    expect(stored.accentColor).toBe("#ff0000");
    expect(stored.buttonShape).toBe("pill");
    expect(stored.maxConcurrent).toBe(3);
    expect(stored.dailyCallQuota).toBe(50);
  });

  test("PATCH rejects malformed origin", async () => {
    const a = seedAgent({ userId: USER_A });
    seedEmbedConfig({ userId: USER_A, agentId: a.id });
    const res = await authedFetch(app, `/agents/${a.id}/embed`, USER_A, {
      method: "PATCH",
      body: JSON.stringify({
        allowedOrigins: ["https://acme.com/path"],
      }),
    });
    expect(res.status).toBe(400);
  });

  test("PATCH rejects bad accent color", async () => {
    const a = seedAgent({ userId: USER_A });
    seedEmbedConfig({ userId: USER_A, agentId: a.id });
    const res = await authedFetch(app, `/agents/${a.id}/embed`, USER_A, {
      method: "PATCH",
      body: JSON.stringify({ accentColor: "red" }),
    });
    expect(res.status).toBe(400);
  });

  test("PATCH SVG with <script> is rejected as invalid", async () => {
    const a = seedAgent({ userId: USER_A });
    seedEmbedConfig({ userId: USER_A, agentId: a.id });
    const res = await authedFetch(app, `/agents/${a.id}/embed`, USER_A, {
      method: "PATCH",
      body: JSON.stringify({
        buttonIconSvg:
          '<svg viewBox="0 0 10 10"><script>alert(1)</script><circle cx="5" cy="5" r="3"/></svg>',
      }),
    });
    expect(res.status).toBe(400);
  });

  test("PATCH SVG with allowed shapes is accepted and stored sanitized", async () => {
    const a = seedAgent({ userId: USER_A });
    seedEmbedConfig({ userId: USER_A, agentId: a.id });
    const res = await authedFetch(app, `/agents/${a.id}/embed`, USER_A, {
      method: "PATCH",
      body: JSON.stringify({
        buttonIconSvg:
          '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="3" fill="#000"/></svg>',
      }),
    });
    expect(res.status).toBe(200);
    const stored = getEmbedConfigStore()[0]!;
    expect(stored.buttonIconSvg).toContain("<svg");
    expect(stored.buttonIconSvg).toContain("<circle");
  });

  test("POST /rotate-key replaces publicKey", async () => {
    const a = seedAgent({ userId: USER_A });
    const c = seedEmbedConfig({ userId: USER_A, agentId: a.id });
    const before = c.publicKey;
    const res = await authedFetch(
      app,
      `/agents/${a.id}/embed/rotate-key`,
      USER_A,
      { method: "POST" },
    );
    expect(res.status).toBe(200);
    const after = getEmbedConfigStore()[0]!.publicKey;
    expect(after).not.toBe(before);
  });

  test("DELETE removes config (cross-user blocked)", async () => {
    const a = seedAgent({ userId: USER_A });
    seedEmbedConfig({ userId: USER_A, agentId: a.id });

    const other = await authedFetch(app, `/agents/${a.id}/embed`, USER_B, {
      method: "DELETE",
    });
    expect(other.status).toBe(404);

    const mine = await authedFetch(app, `/agents/${a.id}/embed`, USER_A, {
      method: "DELETE",
    });
    expect(mine.status).toBe(200);
    expect(getEmbedConfigStore()).toHaveLength(0);
  });
});

// --------------------------------------------------------------------------
// Public endpoints
// --------------------------------------------------------------------------

describe("Embed public /embed/:publicKey/config", () => {
  test("returns theme + agent name when enabled", async () => {
    const a = seedAgent({ userId: USER_A, name: "Bella" });
    const c = seedEmbedConfig({
      userId: USER_A,
      agentId: a.id,
      buttonLabel: "Chat",
      greetingText: "Hi!",
    });

    const res = await app.request(`/embed/${c.publicKey}/config`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      theme: { agentName: string; buttonLabel: string; greetingText: string };
    };
    expect(body.theme.agentName).toBe("Bella");
    expect(body.theme.buttonLabel).toBe("Chat");
    expect(body.theme.greetingText).toBe("Hi!");
    // Make sure no internal fields leak.
    expect(JSON.stringify(body)).not.toContain("agentId");
    expect(JSON.stringify(body)).not.toContain("userId");
    expect(JSON.stringify(body)).not.toContain("allowedOrigins");
  });

  test("disabled config returns 404", async () => {
    const a = seedAgent({ userId: USER_A });
    const c = seedEmbedConfig({
      userId: USER_A,
      agentId: a.id,
      enabled: false,
    });
    const res = await app.request(`/embed/${c.publicKey}/config`);
    expect(res.status).toBe(404);
  });

  test("rotated key invalidates the old key", async () => {
    const a = seedAgent({ userId: USER_A });
    const c = seedEmbedConfig({ userId: USER_A, agentId: a.id });
    const oldKey = c.publicKey;

    await authedFetch(app, `/agents/${a.id}/embed/rotate-key`, USER_A, {
      method: "POST",
    });

    const res = await app.request(`/embed/${oldKey}/config`);
    expect(res.status).toBe(404);
  });
});

describe("Embed public POST /embed/token", () => {
  function tokenRequest(publicKey: string, parentOrigin: string | null) {
    const body: Record<string, string> = { publicKey };
    if (parentOrigin !== null) body.parentOrigin = parentOrigin;
    return app.request(`/embed/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  test("happy path — issues token + dispatch + records call", async () => {
    const a = seedAgent({ userId: USER_A, voiceId: "v_x" });
    const c = seedEmbedConfig({
      userId: USER_A,
      agentId: a.id,
      allowedOrigins: JSON.stringify(["http://localhost:8000"]),
    });
    const res = await tokenRequest(c.publicKey, "http://localhost:8000");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      url: string;
      token: string;
      room: string;
    };
    expect(body.token.length).toBeGreaterThan(0);
    expect(body.room.startsWith(`embed-${a.id}-`)).toBe(true);
    expect(getEmbedCallStore()).toHaveLength(1);
  });

  test("missing parentOrigin → 400", async () => {
    const a = seedAgent({ userId: USER_A });
    const c = seedEmbedConfig({
      userId: USER_A,
      agentId: a.id,
      allowedOrigins: JSON.stringify(["http://localhost:8000"]),
    });
    const res = await tokenRequest(c.publicKey, null);
    expect(res.status).toBe(400);
  });

  test("malformed parentOrigin → 403", async () => {
    const a = seedAgent({ userId: USER_A });
    const c = seedEmbedConfig({
      userId: USER_A,
      agentId: a.id,
      allowedOrigins: JSON.stringify(["http://localhost:8000"]),
    });
    const res = await tokenRequest(c.publicKey, "not-a-url");
    expect(res.status).toBe(403);
  });

  test("origin not in allowlist → 403", async () => {
    const a = seedAgent({ userId: USER_A });
    const c = seedEmbedConfig({
      userId: USER_A,
      agentId: a.id,
      allowedOrigins: JSON.stringify(["https://acme.com"]),
    });
    const res = await tokenRequest(c.publicKey, "https://evil.com");
    expect(res.status).toBe(403);
  });

  test("disabled embed → 404", async () => {
    const a = seedAgent({ userId: USER_A });
    const c = seedEmbedConfig({
      userId: USER_A,
      agentId: a.id,
      enabled: false,
      allowedOrigins: JSON.stringify(["http://localhost:8000"]),
    });
    const res = await tokenRequest(c.publicKey, "http://localhost:8000");
    expect(res.status).toBe(404);
  });

  test("concurrent cap enforced", async () => {
    const a = seedAgent({ userId: USER_A });
    const c = seedEmbedConfig({
      userId: USER_A,
      agentId: a.id,
      allowedOrigins: JSON.stringify(["http://localhost:8000"]),
      maxConcurrent: 1,
    });
    // Pre-existing live call (endedAt in the future).
    seedEmbedCall({
      publicKey: c.publicKey,
      agentId: a.id,
      room: "embed-existing",
      startedAt: new Date(),
      endedAt: new Date(Date.now() + 5 * 60 * 1000),
    });
    const res = await tokenRequest(c.publicKey, "http://localhost:8000");
    expect(res.status).toBe(429);
  });

  test("expired call doesn't count toward concurrent", async () => {
    const a = seedAgent({ userId: USER_A });
    const c = seedEmbedConfig({
      userId: USER_A,
      agentId: a.id,
      allowedOrigins: JSON.stringify(["http://localhost:8000"]),
      maxConcurrent: 1,
    });
    // Already-ended call (endedAt in the past).
    seedEmbedCall({
      publicKey: c.publicKey,
      agentId: a.id,
      room: "embed-old",
      startedAt: new Date(Date.now() - 60 * 60 * 1000),
      endedAt: new Date(Date.now() - 30 * 60 * 1000),
    });
    const res = await tokenRequest(c.publicKey, "http://localhost:8000");
    expect(res.status).toBe(200);
  });

  test("daily quota enforced", async () => {
    const a = seedAgent({ userId: USER_A });
    const c = seedEmbedConfig({
      userId: USER_A,
      agentId: a.id,
      allowedOrigins: JSON.stringify(["http://localhost:8000"]),
      dailyCallQuota: 1,
    });
    seedEmbedCall({
      publicKey: c.publicKey,
      agentId: a.id,
      room: "embed-today",
      startedAt: new Date(),
      endedAt: new Date(Date.now() - 1000), // already ended → doesn't count concurrent
    });
    const res = await tokenRequest(c.publicKey, "http://localhost:8000");
    expect(res.status).toBe(429);
  });

  test("unknown publicKey → 404", async () => {
    const res = await tokenRequest("pk_doesnotexist", "http://localhost:8000");
    expect(res.status).toBe(404);
  });
});

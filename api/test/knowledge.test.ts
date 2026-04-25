import { beforeEach, describe, expect, test } from "bun:test";
import {
  getAgentKbStore,
  getKbDocumentStore,
  getKnowledgeBaseStore,
  resetFakeDb,
  seedAgent,
  seedAgentKb,
  seedKbDocument,
  seedKnowledgeBase,
} from "./mocks/db.mock";
import { resetLivekitMock } from "./mocks/livekit.mock";
import { authedFetch, buildApp, USER_A, USER_B } from "./helpers";

const app = buildApp();
const INTERNAL_KEY = "test-internal-key-1234567890";

beforeEach(() => {
  resetFakeDb();
  resetLivekitMock();
});

describe("Knowledge base CRUD", () => {
  test("POST creates a KB", async () => {
    const res = await authedFetch(app, "/knowledge", USER_A, {
      method: "POST",
      body: JSON.stringify({ name: "Product docs" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { knowledgeBase: { id: string; name: string } };
    expect(body.knowledgeBase.name).toBe("Product docs");
    expect(getKnowledgeBaseStore()).toHaveLength(1);
  });

  test("POST rejects empty name", async () => {
    const res = await authedFetch(app, "/knowledge", USER_A, {
      method: "POST",
      body: JSON.stringify({ name: "" }),
    });
    expect(res.status).toBe(400);
  });

  test("GET lists only owner's KBs", async () => {
    seedKnowledgeBase({ userId: USER_A, name: "A" });
    seedKnowledgeBase({ userId: USER_B, name: "B" });
    const res = await authedFetch(app, "/knowledge", USER_A);
    const body = (await res.json()) as { knowledgeBases: { name: string }[] };
    expect(body.knowledgeBases).toHaveLength(1);
    expect(body.knowledgeBases[0]?.name).toBe("A");
  });

  test("GET /:id returns 404 cross-user", async () => {
    const kb = seedKnowledgeBase({ userId: USER_A });
    const res = await authedFetch(app, `/knowledge/${kb.id}`, USER_B);
    expect(res.status).toBe(404);
  });

  test("PATCH updates name + toolDescription", async () => {
    const kb = seedKnowledgeBase({ userId: USER_A, name: "old" });
    const res = await authedFetch(app, `/knowledge/${kb.id}`, USER_A, {
      method: "PATCH",
      body: JSON.stringify({
        name: "new",
        toolDescription: "search docs",
      }),
    });
    expect(res.status).toBe(200);
    const stored = getKnowledgeBaseStore()[0]!;
    expect(stored.name).toBe("new");
    expect(stored.toolDescription).toBe("search docs");
  });

  test("DELETE removes KB and dependent rows", async () => {
    const kb = seedKnowledgeBase({ userId: USER_A });
    seedKbDocument({ userId: USER_A, knowledgeBaseId: kb.id });
    const a = seedAgent({ userId: USER_A });
    seedAgentKb({ agentId: a.id, knowledgeBaseId: kb.id });

    const res = await authedFetch(app, `/knowledge/${kb.id}`, USER_A, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    expect(getKnowledgeBaseStore()).toHaveLength(0);
    expect(getKbDocumentStore()).toHaveLength(0);
    expect(getAgentKbStore()).toHaveLength(0);
  });
});

describe("Agent attachment", () => {
  test("POST attaches a KB to an agent", async () => {
    const kb = seedKnowledgeBase({ userId: USER_A });
    const a = seedAgent({ userId: USER_A });
    const res = await authedFetch(app, `/agents/${a.id}/knowledge`, USER_A, {
      method: "POST",
      body: JSON.stringify({ knowledgeBaseId: kb.id }),
    });
    expect(res.status).toBe(201);
    expect(getAgentKbStore()).toHaveLength(1);
  });

  test("POST is idempotent (no duplicate row)", async () => {
    const kb = seedKnowledgeBase({ userId: USER_A });
    const a = seedAgent({ userId: USER_A });
    await authedFetch(app, `/agents/${a.id}/knowledge`, USER_A, {
      method: "POST",
      body: JSON.stringify({ knowledgeBaseId: kb.id }),
    });
    await authedFetch(app, `/agents/${a.id}/knowledge`, USER_A, {
      method: "POST",
      body: JSON.stringify({ knowledgeBaseId: kb.id }),
    });
    expect(getAgentKbStore()).toHaveLength(1);
  });

  test("POST cross-user agent → 404", async () => {
    const kb = seedKnowledgeBase({ userId: USER_A });
    const a = seedAgent({ userId: USER_A });
    const res = await authedFetch(app, `/agents/${a.id}/knowledge`, USER_B, {
      method: "POST",
      body: JSON.stringify({ knowledgeBaseId: kb.id }),
    });
    expect(res.status).toBe(404);
  });

  test("POST cross-user KB → 404", async () => {
    const kb = seedKnowledgeBase({ userId: USER_B });
    const a = seedAgent({ userId: USER_A });
    const res = await authedFetch(app, `/agents/${a.id}/knowledge`, USER_A, {
      method: "POST",
      body: JSON.stringify({ knowledgeBaseId: kb.id }),
    });
    expect(res.status).toBe(404);
  });

  test("DELETE detaches", async () => {
    const kb = seedKnowledgeBase({ userId: USER_A });
    const a = seedAgent({ userId: USER_A });
    seedAgentKb({ agentId: a.id, knowledgeBaseId: kb.id });
    const res = await authedFetch(
      app,
      `/agents/${a.id}/knowledge/${kb.id}`,
      USER_A,
      { method: "DELETE" },
    );
    expect(res.status).toBe(200);
    expect(getAgentKbStore()).toHaveLength(0);
  });

  test("GET returns only attached KBs scoped to user", async () => {
    const kb1 = seedKnowledgeBase({ userId: USER_A, name: "k1" });
    const kb2 = seedKnowledgeBase({ userId: USER_A, name: "k2" });
    seedKnowledgeBase({ userId: USER_A, name: "k3" }); // not attached
    const a = seedAgent({ userId: USER_A });
    seedAgentKb({ agentId: a.id, knowledgeBaseId: kb1.id });
    seedAgentKb({ agentId: a.id, knowledgeBaseId: kb2.id });

    const res = await authedFetch(app, `/agents/${a.id}/knowledge`, USER_A);
    const body = (await res.json()) as {
      knowledgeBases: { name: string }[];
    };
    expect(body.knowledgeBases).toHaveLength(2);
    expect(body.knowledgeBases.map((k) => k.name).sort()).toEqual(["k1", "k2"]);
  });
});

describe("Document delete", () => {
  test("DELETE removes scoped to user", async () => {
    const kb = seedKnowledgeBase({ userId: USER_A });
    const doc = seedKbDocument({
      userId: USER_A,
      knowledgeBaseId: kb.id,
    });

    const other = await authedFetch(app, `/documents/${doc.id}`, USER_B, {
      method: "DELETE",
    });
    expect(other.status).toBe(404);

    const mine = await authedFetch(app, `/documents/${doc.id}`, USER_A, {
      method: "DELETE",
    });
    expect(mine.status).toBe(200);
    expect(getKbDocumentStore()).toHaveLength(0);
  });
});

describe("Internal /internal/kb/search auth", () => {
  test("missing bearer → 401", async () => {
    const kb = seedKnowledgeBase({ userId: USER_A });
    const res = await app.request("/internal/kb/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        knowledgeBaseIds: [kb.id],
        query: "hello",
      }),
    });
    expect(res.status).toBe(401);
  });

  test("wrong bearer → 401", async () => {
    const kb = seedKnowledgeBase({ userId: USER_A });
    const res = await app.request("/internal/kb/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer wrong",
      },
      body: JSON.stringify({
        knowledgeBaseIds: [kb.id],
        query: "hello",
      }),
    });
    expect(res.status).toBe(401);
  });

  test("valid bearer reaches search (502 since no OPENAI_API_KEY in tests)", async () => {
    const kb = seedKnowledgeBase({ userId: USER_A });
    const res = await app.request("/internal/kb/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${INTERNAL_KEY}`,
      },
      body: JSON.stringify({
        knowledgeBaseIds: [kb.id],
        query: "hello",
      }),
    });
    // Auth passed, but embedding is unconfigured in the test env, so we
    // expect 502 (search_failed) — the important assertion is "not 401".
    expect(res.status).not.toBe(401);
  });
});

import { beforeEach, describe, expect, test } from "bun:test";
import {
  getAgentToolStore,
  getMcpServerStore,
  resetFakeDb,
  seedAgent,
  seedAgentTool,
  seedMcpServer,
} from "./mocks/db.mock";
import { resetLivekitMock } from "./mocks/livekit.mock";
import { authedFetch, buildApp, USER_A, USER_B } from "./helpers";

const app = buildApp();

beforeEach(() => {
  resetFakeDb();
  resetLivekitMock();
});

describe("MCP servers CRUD", () => {
  test("POST creates server scoped to agent, redacts headers", async () => {
    const a = seedAgent({ userId: USER_A });

    const res = await authedFetch(
      app,
      `/agents/${a.id}/mcp-servers`,
      USER_A,
      {
        method: "POST",
        body: JSON.stringify({
          label: "Prod Zapier",
          url: "https://actions.zapier.com/mcp/sse",
          headers: { Authorization: "Bearer abc" },
        }),
      },
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      server: { id: string; label: string; hasHeaders: boolean; headers?: unknown };
    };
    expect(body.server.label).toBe("Prod Zapier");
    expect(body.server.hasHeaders).toBe(true);
    expect(body.server.headers).toBeUndefined();

    // Stored blob is encrypted (not plain JSON)
    const stored = getMcpServerStore()[0];
    expect(stored?.headers).not.toBeNull();
    expect(stored?.headers).not.toContain("Bearer");
  });

  test("POST with no headers omits encryption", async () => {
    const a = seedAgent({ userId: USER_A });
    const res = await authedFetch(
      app,
      `/agents/${a.id}/mcp-servers`,
      USER_A,
      {
        method: "POST",
        body: JSON.stringify({
          label: "Public",
          url: "https://public.example.com/mcp",
        }),
      },
    );
    expect(res.status).toBe(201);
    expect(getMcpServerStore()[0]?.headers).toBeNull();
  });

  test("GET lists only servers for this agent", async () => {
    const a1 = seedAgent({ userId: USER_A });
    const a2 = seedAgent({ userId: USER_A });
    seedMcpServer({ userId: USER_A, agentId: a1.id, label: "s1" });
    seedMcpServer({ userId: USER_A, agentId: a2.id, label: "s2" });

    const res = await authedFetch(app, `/agents/${a1.id}/mcp-servers`, USER_A);
    const body = (await res.json()) as { servers: Array<{ label: string }> };
    expect(body.servers).toHaveLength(1);
    expect(body.servers[0]?.label).toBe("s1");
  });

  test("cross-user POST → 404", async () => {
    const a = seedAgent({ userId: USER_A });
    const res = await authedFetch(
      app,
      `/agents/${a.id}/mcp-servers`,
      USER_B,
      {
        method: "POST",
        body: JSON.stringify({
          label: "x",
          url: "https://x.example.com/mcp",
        }),
      },
    );
    expect(res.status).toBe(404);
  });

  test("PATCH rejects no-op body → 400", async () => {
    const a = seedAgent({ userId: USER_A });
    const s = seedMcpServer({ userId: USER_A, agentId: a.id });
    const res = await authedFetch(app, `/mcp-servers/${s.id}`, USER_A, {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  test("PATCH updates label", async () => {
    const a = seedAgent({ userId: USER_A });
    const s = seedMcpServer({ userId: USER_A, agentId: a.id, label: "old" });
    const res = await authedFetch(app, `/mcp-servers/${s.id}`, USER_A, {
      method: "PATCH",
      body: JSON.stringify({ label: "new" }),
    });
    expect(res.status).toBe(200);
    expect(getMcpServerStore()[0]?.label).toBe("new");
  });

  test("DELETE removes scoped by user", async () => {
    const a = seedAgent({ userId: USER_A });
    const s = seedMcpServer({ userId: USER_A, agentId: a.id });

    const other = await authedFetch(app, `/mcp-servers/${s.id}`, USER_B, {
      method: "DELETE",
    });
    expect(other.status).toBe(404);

    const mine = await authedFetch(app, `/mcp-servers/${s.id}`, USER_A, {
      method: "DELETE",
    });
    expect(mine.status).toBe(200);
    expect(getMcpServerStore()).toHaveLength(0);
  });
});

describe("Agent tools CRUD", () => {
  test("POST PRE tool without parameters succeeds", async () => {
    const a = seedAgent({ userId: USER_A });
    const res = await authedFetch(app, `/agents/${a.id}/tools`, USER_A, {
      method: "POST",
      body: JSON.stringify({
        phase: "PRE",
        name: "fetch_caller_info",
        description: "Look up the caller in the CRM.",
        method: "GET",
        url: "https://crm.example.com/lookup?phone={{caller_number}}",
      }),
    });
    expect(res.status).toBe(201);
    expect(getAgentToolStore()[0]?.phase).toBe("PRE");
  });

  test("POST ON tool without parameters → 400", async () => {
    const a = seedAgent({ userId: USER_A });
    const res = await authedFetch(app, `/agents/${a.id}/tools`, USER_A, {
      method: "POST",
      body: JSON.stringify({
        phase: "ON",
        name: "lookup",
        description: "desc",
        method: "GET",
        url: "https://example.com",
      }),
    });
    expect(res.status).toBe(400);
  });

  test("POST ON tool with valid JSON-Schema parameters succeeds", async () => {
    const a = seedAgent({ userId: USER_A });
    const res = await authedFetch(app, `/agents/${a.id}/tools`, USER_A, {
      method: "POST",
      body: JSON.stringify({
        phase: "ON",
        name: "lookup_user",
        description: "Find user by email.",
        method: "GET",
        url: "https://api.example.com/u?email={{email}}",
        parameters: JSON.stringify({
          type: "object",
          properties: { email: { type: "string" } },
          required: ["email"],
        }),
      }),
    });
    expect(res.status).toBe(201);
  });

  test("POST ON tool with invalid JSON in parameters → 400", async () => {
    const a = seedAgent({ userId: USER_A });
    const res = await authedFetch(app, `/agents/${a.id}/tools`, USER_A, {
      method: "POST",
      body: JSON.stringify({
        phase: "ON",
        name: "bad_json",
        description: "desc",
        method: "GET",
        url: "https://example.com",
        parameters: "{not-json}",
      }),
    });
    expect(res.status).toBe(400);
  });

  test("tool name must be an identifier", async () => {
    const a = seedAgent({ userId: USER_A });
    const res = await authedFetch(app, `/agents/${a.id}/tools`, USER_A, {
      method: "POST",
      body: JSON.stringify({
        phase: "POST",
        name: "has spaces",
        description: "desc",
        method: "POST",
        url: "https://example.com/hook",
      }),
    });
    expect(res.status).toBe(400);
  });

  test("GET lists only this agent's tools; ?phase filters", async () => {
    const a = seedAgent({ userId: USER_A });
    seedAgentTool({
      userId: USER_A,
      agentId: a.id,
      phase: "PRE",
      name: "pre1",
    });
    seedAgentTool({
      userId: USER_A,
      agentId: a.id,
      phase: "POST",
      name: "post1",
    });

    const all = await authedFetch(app, `/agents/${a.id}/tools`, USER_A);
    const allBody = (await all.json()) as { tools: Array<{ phase: string }> };
    expect(allBody.tools).toHaveLength(2);

    const postOnly = await authedFetch(
      app,
      `/agents/${a.id}/tools?phase=POST`,
      USER_A,
    );
    const postBody = (await postOnly.json()) as {
      tools: Array<{ phase: string }>;
    };
    expect(postBody.tools).toHaveLength(1);
    expect(postBody.tools[0]?.phase).toBe("POST");
  });

  test("DELETE scoped by user", async () => {
    const a = seedAgent({ userId: USER_A });
    const t = seedAgentTool({
      userId: USER_A,
      agentId: a.id,
      phase: "PRE",
      name: "t",
    });

    const other = await authedFetch(app, `/tools/${t.id}`, USER_B, {
      method: "DELETE",
    });
    expect(other.status).toBe(404);

    const mine = await authedFetch(app, `/tools/${t.id}`, USER_A, {
      method: "DELETE",
    });
    expect(mine.status).toBe(200);
  });
});

describe("buildAgentMetadata includes tools + MCP", () => {
  test("groups tools by phase and omits disabled rows", async () => {
    const { buildAgentMetadata } = await import(
      "../src/telephony/dispatch-rules"
    );

    const a = seedAgent({ userId: USER_A, name: "bot" });
    seedMcpServer({
      userId: USER_A,
      agentId: a.id,
      label: "MCP1",
      enabled: true,
    });
    seedMcpServer({
      userId: USER_A,
      agentId: a.id,
      label: "Disabled",
      enabled: false,
    });
    seedAgentTool({
      userId: USER_A,
      agentId: a.id,
      phase: "PRE",
      name: "pre1",
    });
    seedAgentTool({
      userId: USER_A,
      agentId: a.id,
      phase: "ON",
      name: "on1",
      parameters: JSON.stringify({ type: "object" }),
    });
    seedAgentTool({
      userId: USER_A,
      agentId: a.id,
      phase: "POST",
      name: "post1",
    });
    seedAgentTool({
      userId: USER_A,
      agentId: a.id,
      phase: "ON",
      name: "disabled_on",
      enabled: false,
      parameters: JSON.stringify({ type: "object" }),
    });

    const raw = await buildAgentMetadata({
      id: a.id,
      userId: a.userId,
      name: a.name,
      type: a.type,
      voiceId: a.voiceId,
      language: a.language,
      firstMessage: a.firstMessage,
      objective: a.objective,
      responseGuidelines: a.responseGuidelines,
      conversationScript: a.conversationScript,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    });
    const meta = JSON.parse(raw) as {
      mcpServers: Array<{ label: string }>;
      tools: { pre: unknown[]; on: unknown[]; post: unknown[] };
    };

    expect(meta.mcpServers).toHaveLength(1);
    expect(meta.mcpServers[0]?.label).toBe("MCP1");
    expect(meta.tools.pre).toHaveLength(1);
    expect(meta.tools.on).toHaveLength(1);
    expect(meta.tools.post).toHaveLength(1);
  });
});

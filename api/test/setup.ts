/**
 * Global test setup. Preloaded via bunfig.toml so every module mock is in
 * place before any test file imports application code.
 *
 * What we mock:
 *   - ../src/env          → stable, test-friendly env
 *   - ../src/middleware/auth → recognizes magic "Bearer test-<uuid>" tokens
 *   - ../src/config/database → in-memory agents table with just the Drizzle
 *                              surface our routes use
 *   - livekit-server-sdk  → in-memory AccessToken + AgentDispatchClient
 *   - global fetch        → routed through a queue the tests can stub
 */

import { mock } from "bun:test";

// ---- env ----

mock.module("../src/env", () => ({
  env: {
    SUPABASE_URL: "https://placeholder.supabase.co",
    PORT: 8787,
    ALLOWED_ORIGIN: "http://localhost:3000",
    DATABASE_URL: "postgres://placeholder",
    CARTESIA_API_KEY: "test_cartesia_key",
    CARTESIA_API_VERSION: "2026-03-01",
    LIVEKIT_URL: "ws://placeholder.livekit",
    LIVEKIT_API_KEY: "test_livekit_key",
    LIVEKIT_API_SECRET: "test_livekit_secret",
    LIVEKIT_SIP_URI: "sip:placeholder.sip.livekit.cloud",
    API_ENCRYPTION_KEY: "w7rCw2lyVE3O/b2g4usieEH+C9LKEhZPAvXW9TGvCy4=",
    INTERNAL_API_KEY: "test-internal-key-1234567890",
  },
}));

// ---- auth ----

export const USER_A = "00000000-0000-0000-0000-0000000000aa";
export const USER_B = "00000000-0000-0000-0000-0000000000bb";

mock.module("../src/middleware/auth", () => ({
  requireAuth: async (c: any, next: () => Promise<void>) => {
    const header =
      c.req.header("authorization") ?? c.req.header("Authorization");
    if (!header?.startsWith("Bearer ")) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token.startsWith("test-")) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const sub = token.slice("test-".length);
    c.set("user", { sub, email: `${sub}@example.test` });
    await next();
  },
}));

// ---- drizzle operators (must run before database) ----

import "./mocks/drizzle-orm.mock";

// ---- database ----

import {
  makeFakeDb,
  resetFakeDb,
  seedAgent,
  type FakeAgent,
} from "./mocks/db.mock";

mock.module("../src/config/database", () => ({
  db: makeFakeDb(),
  connectDB: () => {},
}));

// Re-export for tests to seed/reset.
export { resetFakeDb, seedAgent, type FakeAgent };

// ---- livekit ----

import { installLivekitMock, resetLivekitMock } from "./mocks/livekit.mock";

installLivekitMock();

export { resetLivekitMock };

// ---- fetch (for Cartesia voice proxy tests) ----

import {
  installFetchMock,
  resetFetchMock,
} from "./mocks/fetch.mock";

installFetchMock();

export { resetFetchMock };

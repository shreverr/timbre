import { describe, expect, test } from "bun:test";
import { authedFetch, buildApp, USER_A } from "./helpers";

describe("auth middleware", () => {
  const app = buildApp();

  test("public GET / does not require auth", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Hello Hono!");
  });

  test("GET /me without token → 401", async () => {
    const res = await app.request("/me");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  test("GET /me with malformed Authorization header → 401", async () => {
    const res = await app.request("/me", {
      headers: { Authorization: "NotBearer xyz" },
    });
    expect(res.status).toBe(401);
  });

  test("GET /me with empty Bearer token → 401", async () => {
    const res = await app.request("/me", {
      headers: { Authorization: "Bearer   " },
    });
    expect(res.status).toBe(401);
  });

  test("GET /me with valid test token → 200 and returns user claims", async () => {
    const res = await authedFetch(app, "/me", USER_A);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { sub: string } };
    expect(body.user.sub).toBe(USER_A);
  });

  test("GET /agents without token → 401", async () => {
    const res = await app.request("/agents");
    expect(res.status).toBe(401);
  });

  test("POST /agents without token → 401", async () => {
    const res = await app.request("/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x" }),
    });
    expect(res.status).toBe(401);
  });

  test("GET /voices without token → 401", async () => {
    const res = await app.request("/voices");
    expect(res.status).toBe(401);
  });
});

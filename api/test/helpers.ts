import { Hono } from "hono";
import { cors } from "hono/cors";
import agentToolsRouter from "../src/routes/agent-tools";
import agentsRouter from "../src/routes/agents";
import callsRouter from "../src/routes/calls";
import demoRouter from "../src/routes/demo";
import embedRouter from "../src/routes/embed";
import knowledgeRouter from "../src/routes/knowledge";
import telephonyRouter from "../src/routes/telephony";
import voicesRouter from "../src/routes/voices";
import { requireAuth } from "../src/middleware/auth";

export const USER_A = "00000000-0000-0000-0000-0000000000aa";
export const USER_B = "00000000-0000-0000-0000-0000000000bb";

/** Build a fresh Hono app with the routes we expose in production. */
export function buildApp() {
  const app = new Hono();
  app.use(
    "*",
    cors({
      origin: "http://localhost:3000",
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      credentials: true,
    }),
  );
  app.get("/", (c) => c.text("Hello Hono!"));
  app.get("/me", requireAuth, (c) => c.json({ user: c.get("user") }));
  app.route("/agents", agentsRouter);
  app.route("/voices", voicesRouter);
  app.route("/telephony", telephonyRouter);
  app.route("/", callsRouter);
  app.route("/", demoRouter);
  app.route("/", embedRouter);
  app.route("/", knowledgeRouter);
  app.route("/", agentToolsRouter);
  return app;
}

export function tokenFor(userId: string) {
  return `Bearer test-${userId}`;
}

export function authedFetch(
  app: Hono,
  url: string,
  userId: string,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", tokenFor(userId));
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return app.request(url, { ...init, headers });
}

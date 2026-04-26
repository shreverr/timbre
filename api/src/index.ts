import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./env";
import { requireAuth } from "./middleware/auth";
import { connectDB } from "./config/database";
import agentToolsRouter from "./routes/agent-tools";
import agentsRouter from "./routes/agents";
import callsRouter from "./routes/calls";
import demoRouter from "./routes/demo";
import embedRouter from "./routes/embed";
import knowledgeRouter from "./routes/knowledge";
import telephonyRouter from "./routes/telephony";
import voicesRouter from "./routes/voices";

const app = new Hono();
connectDB()

app.use(
  "*",
  cors({
    origin: env.ALLOWED_ORIGIN,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

app.get("/", (c) => c.text("Hello Hono!"));

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/me", requireAuth, (c) => {
  const user = c.get("user");
  return c.json({ user });
});

app.route("/agents", agentsRouter);
app.route("/voices", voicesRouter);
app.route("/telephony", telephonyRouter);
app.route("/", callsRouter);
app.route("/", demoRouter);
app.route("/", embedRouter);
app.route("/", knowledgeRouter);
app.route("/", agentToolsRouter);

app.use("/api/*", requireAuth);

export default {
  port: env.PORT,
  fetch: app.fetch,
};

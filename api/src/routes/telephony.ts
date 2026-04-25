import { zValidator } from "@hono/zod-validator";
import { SipClient } from "livekit-server-sdk";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../config/database";
import { phoneNumbers, telephonyProviders } from "../db/schema";
import { env } from "../env";
import { requireAuth } from "../middleware/auth";
import { getDriver } from "../telephony";
import {
  syncDispatchRuleForNumber,
  teardownNumber,
} from "../telephony/dispatch-rules";
import type { ProviderCredentials } from "../telephony/drivers/base";
import { decryptJson, encryptJson } from "../telephony/encrypt";

let sipClient: SipClient | null = null;
function getSipClient(): SipClient {
  if (!sipClient) {
    sipClient = new SipClient(
      env.LIVEKIT_URL,
      env.LIVEKIT_API_KEY,
      env.LIVEKIT_API_SECRET,
    );
  }
  return sipClient;
}

const twilioCredsSchema = z.object({
  type: z.literal("twilio"),
  accountSid: z.string().trim().min(1),
  authToken: z.string().trim().min(1),
  sipUsername: z.string().trim().min(1),
  sipPassword: z.string().trim().min(1),
  terminationUri: z.string().trim().min(1),
});

const createProviderSchema = z.object({
  type: z.enum(["twilio"]),
  label: z.string().trim().min(1).max(100),
  credentials: twilioCredsSchema,
});

const createNumberSchema = z.object({
  providerId: z.string().uuid(),
  e164: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, "must be E.164 like +14155551212"),
  agentId: z.string().uuid().nullable().optional(),
});

const updateNumberSchema = z.object({
  agentId: z.string().uuid().nullable(),
});

const telephonyRouter = new Hono();

telephonyRouter.use("*", requireAuth);

// -------- providers --------

function redactProvider(row: typeof telephonyProviders.$inferSelect) {
  const { credentials: _credentials, ...safe } = row;
  return safe;
}

telephonyRouter.get("/providers", async (c) => {
  const user = c.get("user");
  const rows = await db
    .select()
    .from(telephonyProviders)
    .where(eq(telephonyProviders.userId, user.sub))
    .orderBy(desc(telephonyProviders.createdAt));
  return c.json({ providers: rows.map(redactProvider) });
});

telephonyRouter.get("/providers/setup/:type", async (c) => {
  const type = c.req.param("type");
  if (type !== "twilio") {
    return c.json({ error: "unknown provider" }, 404);
  }
  const driver = getDriver("twilio");
  return c.json({
    instructions: driver.setupInstructions(env.LIVEKIT_SIP_URI),
  });
});

telephonyRouter.post(
  "/providers",
  zValidator("json", createProviderSchema),
  async (c) => {
    const user = c.get("user");
    const body = c.req.valid("json");
    const driver = getDriver(body.type);

    const verifyResult = await driver.verify(
      body.credentials as ProviderCredentials,
    );
    if (!verifyResult.ok) {
      return c.json({ error: verifyResult.reason }, 400);
    }

    const { trunkId: outboundTrunkId } = await driver.createOutboundTrunk({
      name: `timbre-outbound-${user.sub.slice(0, 8)}`,
      creds: body.credentials as ProviderCredentials,
      numbers: [],
    });

    const [row] = await db
      .insert(telephonyProviders)
      .values({
        userId: user.sub,
        type: body.type,
        label: body.label,
        credentials: encryptJson(body.credentials),
        livekitOutboundTrunkId: outboundTrunkId,
      })
      .returning();
    return c.json({ provider: redactProvider(row!) }, 201);
  },
);

telephonyRouter.delete("/providers/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const dependents = await db
    .select()
    .from(phoneNumbers)
    .where(
      and(eq(phoneNumbers.providerId, id), eq(phoneNumbers.userId, user.sub)),
    );
  if (dependents.length > 0) {
    return c.json(
      { error: "remove all phone numbers attached to this provider first" },
      400,
    );
  }

  const [row] = await db
    .delete(telephonyProviders)
    .where(
      and(
        eq(telephonyProviders.id, id),
        eq(telephonyProviders.userId, user.sub),
      ),
    )
    .returning();
  if (!row) return c.json({ error: "not found" }, 404);

  if (row.livekitOutboundTrunkId) {
    try {
      await getSipClient().deleteSipTrunk(row.livekitOutboundTrunkId);
    } catch (err) {
      console.warn("failed to delete LiveKit outbound trunk", err);
    }
  }

  return c.json({ ok: true });
});

// -------- numbers --------

telephonyRouter.get("/numbers", async (c) => {
  const user = c.get("user");
  const rows = await db
    .select()
    .from(phoneNumbers)
    .where(eq(phoneNumbers.userId, user.sub))
    .orderBy(desc(phoneNumbers.createdAt));
  return c.json({ numbers: rows });
});

telephonyRouter.post(
  "/numbers",
  zValidator("json", createNumberSchema),
  async (c) => {
    const user = c.get("user");
    const { providerId, e164, agentId } = c.req.valid("json");

    // Confirm the provider belongs to this user.
    const [provider] = await db
      .select()
      .from(telephonyProviders)
      .where(
        and(
          eq(telephonyProviders.id, providerId),
          eq(telephonyProviders.userId, user.sub),
        ),
      );
    if (!provider) return c.json({ error: "provider not found" }, 400);

    const [row] = await db
      .insert(phoneNumbers)
      .values({
        userId: user.sub,
        providerId,
        e164,
        agentId: agentId ?? null,
      })
      .returning();

    if (row!.agentId) {
      try {
        await syncDispatchRuleForNumber(row!);
      } catch (err) {
        console.error("syncDispatchRuleForNumber failed", err);
      }
    }

    const [fresh] = await db
      .select()
      .from(phoneNumbers)
      .where(eq(phoneNumbers.id, row!.id));
    return c.json({ number: fresh }, 201);
  },
);

telephonyRouter.patch(
  "/numbers/:id",
  zValidator("json", updateNumberSchema),
  async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const { agentId } = c.req.valid("json");

    const [row] = await db
      .update(phoneNumbers)
      .set({ agentId, updatedAt: new Date() })
      .where(and(eq(phoneNumbers.id, id), eq(phoneNumbers.userId, user.sub)))
      .returning();
    if (!row) return c.json({ error: "not found" }, 404);

    try {
      await syncDispatchRuleForNumber(row);
    } catch (err) {
      console.error("syncDispatchRuleForNumber failed", err);
    }

    const [fresh] = await db
      .select()
      .from(phoneNumbers)
      .where(eq(phoneNumbers.id, id));
    return c.json({ number: fresh });
  },
);

telephonyRouter.delete("/numbers/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const [row] = await db
    .delete(phoneNumbers)
    .where(and(eq(phoneNumbers.id, id), eq(phoneNumbers.userId, user.sub)))
    .returning();
  if (!row) return c.json({ error: "not found" }, 404);

  await teardownNumber(row);
  return c.json({ ok: true });
});

export default telephonyRouter;

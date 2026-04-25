import { z } from "zod";

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(8787),
  ALLOWED_ORIGIN: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().url(),
  CARTESIA_API_KEY: z.string().min(1),
  CARTESIA_API_VERSION: z.string().default("2026-03-01"),
  LIVEKIT_URL: z.string().url(),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  LIVEKIT_SIP_URI: z.string().default(""),
  API_ENCRYPTION_KEY: z
    .string()
    .min(1, "API_ENCRYPTION_KEY required (32-byte base64)"),
  DEMO_AGENT_ID: z.string().uuid().optional(),
  DEMO_ALLOWED_ORIGIN: z.string().optional(),
  INTERNAL_API_KEY: z
    .string()
    .min(16, "INTERNAL_API_KEY must be at least 16 chars"),
  OPENAI_API_KEY: z.string().min(1).optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment variables:",
    parsed.error.flatten().fieldErrors,
  );
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { env } from "../env";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = Buffer.from(env.API_ENCRYPTION_KEY, "base64");
  if (raw.length !== 32) {
    throw new Error(
      "API_ENCRYPTION_KEY must decode to 32 bytes (base64-encoded 256-bit key)",
    );
  }
  cachedKey = raw;
  return raw;
}

/** Encrypts a JSON-serializable value. Output format: `v1:<iv>:<tag>:<ct>` (all base64). */
export function encryptJson(value: unknown): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptJson<T = unknown>(blob: string): T {
  const parts = blob.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("invalid ciphertext format");
  }
  const iv = Buffer.from(parts[1]!, "base64");
  const tag = Buffer.from(parts[2]!, "base64");
  const ciphertext = Buffer.from(parts[3]!, "base64");
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}

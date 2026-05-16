import type { MiddlewareHandler } from "hono";
import jwt, { type JwtHeader, type SigningKeyCallback } from "jsonwebtoken";
import { JwksClient } from "jwks-rsa";
import { env } from "../env";

type AuthUser = {
  sub: string;
  email?: string;
  role?: string;
  [key: string]: unknown;
};

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

const ISSUER = `${env.SUPABASE_URL}/auth/v1`;
const JWKS_URI = `${ISSUER}/.well-known/jwks.json`;

const jwks = new JwksClient({
  jwksUri: JWKS_URI,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000,
  rateLimit: false,
});

function getKey(header: JwtHeader, callback: SigningKeyCallback) {
  if (!header.kid) {
    callback(new Error("missing kid in jwt header"));
    return;
  }
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err || !key) {
      callback(err ?? new Error("signing key not found"));
      return;
    }
    callback(null, key.getPublicKey());
  });
}

function verify(token: string): Promise<AuthUser> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        algorithms: ["ES256", "RS256"],
        issuer: ISSUER,
        audience: "authenticated",
      },
      (err, decoded) => {
        if (err || !decoded || typeof decoded !== "object") {
          reject(err ?? new Error("invalid token"));
          return;
        }
        resolve(decoded as AuthUser);
      },
    );
  });
}

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const header = c.req.header("authorization") ?? c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    return c.json({ error: "unauthorized" }, 401);
  }

  try {
    const user = await verify(token);
    c.set("user", user);
  } catch {
    return c.json({ error: "unauthorized" }, 401);
  }

  await next();
};

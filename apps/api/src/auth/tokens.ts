import type { AuthTokens } from "@ai-companion/shared";
import type { Env } from "@/env";
import { ttlSeconds } from "@/env";
import { hashOpaqueToken } from "@/auth/password";

const encoder = new TextEncoder();

type AccessTokenPayload = {
  sub: string;
  exp: number;
  iat: number;
};

function base64Url(input: ArrayBuffer | string) {
  const value =
    typeof input === "string"
      ? btoa(input)
      : btoa(String.fromCharCode(...new Uint8Array(input)));
  return value.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(input: string) {
  const normalized = input.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return base64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

export async function createAccessToken(userId: string, env: Env) {
  const now = Math.floor(Date.now() / 1000);
  const payload: AccessTokenPayload = {
    sub: userId,
    iat: now,
    exp: now + ttlSeconds(env.ACCESS_TOKEN_TTL_SECONDS, 900)
  };
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64Url(JSON.stringify(payload));
  const signature = await sign(`${header}.${body}`, env.JWT_SECRET);
  return `${header}.${body}.${signature}`;
}

export async function verifyAccessToken(token: string, env: Env) {
  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature) return null;
  const expected = await sign(`${header}.${body}`, env.JWT_SECRET);
  if (expected !== signature) return null;
  const payload = JSON.parse(fromBase64Url(body)) as AccessTokenPayload;
  if (!payload.sub || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function createRefreshToken() {
  return crypto.randomUUID() + "." + crypto.randomUUID();
}

export async function createTokenPair(userId: string, env: Env): Promise<AuthTokens> {
  return {
    access_token: await createAccessToken(userId, env),
    refresh_token: createRefreshToken()
  };
}

export async function refreshTokenRecord(token: string, env: Env) {
  return {
    tokenHash: await hashOpaqueToken(token, env),
    expiresAt:
      Math.floor(Date.now() / 1000) +
      ttlSeconds(env.REFRESH_TOKEN_TTL_SECONDS, 2592000)
  };
}

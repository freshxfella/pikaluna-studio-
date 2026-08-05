// Verifies fal.ai webhook signatures per https://docs.fal.ai (ED25519 + JWKS).
// Uses built-in WebCrypto (Node 20+/Vercel) — no extra crypto deps needed.

const JWKS_URL = "https://rest.fal.ai/.well-known/jwks.json";
const CACHE_MS = 24 * 60 * 60 * 1000; // JWKS cacheable up to 24h

let jwksCache: { x: string }[] | null = null;
let jwksCachedAt = 0;

async function fetchJwks(): Promise<{ x: string }[]> {
  if (jwksCache && Date.now() - jwksCachedAt < CACHE_MS) return jwksCache;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const data = (await res.json()) as { keys?: { x: string }[] };
  jwksCache = data.keys ?? [];
  jwksCachedAt = Date.now();
  return jwksCache;
}

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
  return out;
}

export interface FalWebhookHeaders {
  requestId: string | null;
  userId: string | null;
  timestamp: string | null;
  signature: string | null;
}

export function readFalHeaders(h: Headers): FalWebhookHeaders {
  return {
    requestId: h.get("x-fal-webhook-request-id"),
    userId: h.get("x-fal-webhook-user-id"),
    timestamp: h.get("x-fal-webhook-timestamp"),
    signature: h.get("x-fal-webhook-signature"),
  };
}

// `rawBody` MUST be the exact bytes fal sent (read before JSON.parse).
export async function verifyFalWebhook(
  headers: FalWebhookHeaders,
  rawBody: string
): Promise<boolean> {
  const { requestId, userId, timestamp, signature } = headers;
  if (!requestId || !userId || !timestamp || !signature) return false;

  // Reject stale/replayed requests (±5 min leeway).
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) {
    return false;
  }

  // message = requestId \n userId \n timestamp \n sha256hex(body)
  const bodyHash = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawBody)));
  const message = new TextEncoder().encode([requestId, userId, timestamp, bodyHash].join("\n"));
  const sig = hexToBytes(signature);

  const keys = await fetchJwks();
  for (const key of keys) {
    try {
      const publicKey = await crypto.subtle.importKey(
        "jwk",
        { kty: "OKP", crv: "Ed25519", x: key.x },
        { name: "Ed25519" },
        false,
        ["verify"]
      );
      if (await crypto.subtle.verify("Ed25519", publicKey, sig, message)) return true;
    } catch {
      // try next key
    }
  }
  return false;
}

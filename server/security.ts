/** Shared security helpers for the Roll & Run API. */

export const SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000;
export const SESSION_IDLE_MS = 60 * 60 * 1000;
export const MAX_JSON_BYTES = 16_384;

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function clientSafeError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const message = error.message || fallback;
  // Never return upstream Strava payload bodies to browsers or OAuth redirects.
  if (/strava/i.test(message) && /\d{3}\s/.test(message)) return fallback;
  if (message.length > 120) return fallback;
  return message;
}

export function applySecurityHeaders(headers: Headers): void {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );
  headers.set("Cross-Origin-Resource-Policy", "cross-origin");
}

function base64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function createCodeVerifier(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64Url(digest);
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }
  current.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

export function clientKey(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function sessionWithinLimits(createdAt: string, lastActiveAt: string): boolean {
  const created = Date.parse(createdAt);
  const lastActive = Date.parse(lastActiveAt);
  if (!Number.isFinite(created) || !Number.isFinite(lastActive)) return false;
  const now = Date.now();
  if (now - created > SESSION_ABSOLUTE_MS) return false;
  if (now - lastActive > SESSION_IDLE_MS) return false;
  return true;
}

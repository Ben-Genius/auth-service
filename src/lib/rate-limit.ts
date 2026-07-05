// =============================================================================
// RATE LIMITER — Protect your auth endpoints from brute-force attacks
// =============================================================================
// WHY RATE LIMITING?
// Without it, an attacker could try millions of password combinations per second.
// Rate limiting says: "max X requests per Y seconds per IP address."
//
// HOW IT WORKS:
// We store a simple in-memory map: { ipAddress → { count, lastReset } }
// On each request, we check if the count exceeds the limit.
// If so, we return HTTP 429 (Too Many Requests).
//
// LIMITATIONS OF THIS APPROACH:
// - In-memory storage is lost on server restart (acceptable for learning).
// - Doesn't work across multiple server instances (use Redis for production).
// - IP-based limiting can be bypassed with proxies/VPNs (acceptable for a starter).
//
// FOR PRODUCTION, consider:
// - "upstash/ratelimit" (Redis-backed, works on Edge)
// - Or store rate limit data in your database
// =============================================================================

interface RateLimitEntry {
  count: number;
  lastReset: number; // Unix timestamp in ms
}

// In-memory store — a Map is essentially a dictionary/object with O(1) lookups
const store = new Map<string, RateLimitEntry>();

/**
 * Configuration for a single rate limit rule.
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
}

// Predefined configs for different endpoint types
export const RATE_LIMITS = {
  /** For login/register: 5 attempts per 60 seconds */
  auth: { maxRequests: 5, windowSeconds: 60 } satisfies RateLimitConfig,
  /** For OTP: 3 sends per 60 seconds */
  otp: { maxRequests: 3, windowSeconds: 60 } satisfies RateLimitConfig,
  /** For general API endpoints: 30 requests per 60 seconds */
  general: { maxRequests: 30, windowSeconds: 60 } satisfies RateLimitConfig,
} as const;

/**
 * Check if a request should be rate-limited.
 *
 * @param key - Unique identifier for the requester (usually IP address)
 * @param config - Rate limit configuration
 * @returns An object with:
 *   - allowed: boolean (true if the request can proceed)
 *   - remaining: number (how many requests are left in this window)
 *   - resetIn: number (seconds until the window resets)
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  const entry = store.get(key);

  // No entry exists — this is the first request from this key
  if (!entry) {
    store.set(key, { count: 1, lastReset: now });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowSeconds,
    };
  }

  // Check if the time window has expired
  const timeSinceReset = now - entry.lastReset;
  if (timeSinceReset >= windowMs) {
    // Window expired — reset the counter
    store.set(key, { count: 1, lastReset: now });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowSeconds,
    };
  }

  // Within the window — check if limit exceeded
  if (entry.count >= config.maxRequests) {
    const resetIn = Math.ceil(
      (windowMs - timeSinceReset) / 1000
    );
    return {
      allowed: false,
      remaining: 0,
      resetIn,
    };
  }

  // Increment counter and allow
  entry.count += 1;
  store.set(key, entry);
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetIn: Math.ceil((windowMs - timeSinceReset) / 1000),
  };
}

// -----------------------------------------------------------------------------
// HELPER: Extract IP address from a Next.js request
// -----------------------------------------------------------------------------
// In production behind a reverse proxy (nginx, Cloudflare), the real IP
// is in the X-Forwarded-For header. For local dev, it's typically "127.0.0.1".
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
    // The first one is the original client IP
    return forwarded.split(",")[0].trim();
  }
  return "127.0.0.1"; // fallback for local development
}
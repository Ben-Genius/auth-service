// =============================================================================
// API KEY MANAGEMENT
// =============================================================================
// HOW API KEYS WORK IN AN AUTH SERVICE:
//
// When a developer creates a project, we generate a unique API key.
// The developer puts this key in their app's backend code.
// Every request their app makes to our service includes this key
// in the `Authorization: Bearer <key>` header (or `X-API-Key` header).
//
// We look up the key in our database to find which project it belongs to,
// then scope all operations to that project.
//
// WHY USE API KEYS INSTEAD OF PASSWORDS?
// - API keys are NOT secret in the same way as passwords.
//   They're meant to be used in server-to-server communication.
// - They can be rotated (deleted and regenerated) without changing a password.
// - They're long and random (hard to guess) but easy to copy-paste.
//
// FORMAT: "ak_" prefix + 32 random hex characters
// The prefix makes keys identifiable at a glance (you can tell it's an API key).
// Examples: "ak_a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5"
// =============================================================================

import crypto from "crypto";

/**
 * Generate a new API key.
 *
 * @returns The full key string (e.g., "ak_a3f8b2c1...")
 */
export function generateApiKey(): string {
  // 32 bytes = 64 hex characters. We use 32 hex chars for readability.
  const bytes = crypto.randomBytes(24);
  return `ak_${bytes.toString("hex")}`;
}

/**
 * Extract an API key from request headers.
 *
 * We support two header formats:
 * 1. `Authorization: Bearer ak_xxxxx`  (OAuth2-style, most common)
 * 2. `X-API-Key: ak_xxxxx`             (simple custom header)
 *
 * WHY TWO FORMATS?
 * Authorization: Bearer is the HTTP standard. Many HTTP clients
 * (fetch, axios) handle it natively. X-API-Key is a fallback for
 * simpler setups.
 */
export function extractApiKey(request: Request): string | null {
  // Try Authorization: Bearer <key> first
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const key = authHeader.slice(7); // remove "Bearer " prefix
    if (key.startsWith("ak_")) return key;
  }

  // Try X-API-Key header as fallback
  const apiKeyHeader = request.headers.get("x-api-key");
  if (apiKeyHeader?.startsWith("ak_")) return apiKeyHeader;

  return null;
}
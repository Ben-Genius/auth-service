// =============================================================================
// POST /api/v1/auth/register — THE PRODUCT: Other apps call this to register users
// =============================================================================
// This is NOT for our portal. Other developers call this endpoint from THEIR apps.
//
// HOW IT DIFFERS FROM PORTAL AUTH:
// - Authenticated via API key (not portal JWT cookie)
// - Creates a ServiceUser scoped to the project (not a Developer)
// - Returns a JWT that the OTHER app uses (not a portal cookie)
//
// THE CALLING PATTERN (from another developer's app):
//   fetch("https://your-auth-service.com/api/v1/auth/register", {
//     method: "POST",
//     headers: {
//       "Authorization": "Bearer ak_xxxxx",
//       "Content-Type": "application/json",
//     },
//     body: JSON.stringify({ email: "user@theirapp.com", password: "..." }),
//   })
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createServiceToken } from "@/lib/auth";
import { extractApiKey } from "@/lib/api-key";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { addCorsHeaders, handleCorsPreFlight } from "@/lib/cors";

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreFlight(request);
}

export async function POST(request: NextRequest) {
  // -------------------------------------------------------------------------
  // STEP 1: Authenticate via API key
  // -------------------------------------------------------------------------
  // This is how we know WHICH project is making the request.
  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return addCorsHeaders(NextResponse.json(
      { error: "Missing API key. Include it as: Authorization: Bearer ak_xxx or X-API-Key: ak_xxx" },
      { status: 401 }
    ), request);
  }

  const project = await db.project.findUnique({ where: { apiKey } });
  if (!project) {
    return addCorsHeaders(NextResponse.json({ error: "Invalid API key" }, { status: 401 }), request);
  }

  // -------------------------------------------------------------------------
  // STEP 2: Rate limiting (per project, not per IP)
  // -------------------------------------------------------------------------
  // WHY per project? The calling app's backend makes all requests,
  // so IP-based limiting would block ALL projects behind the same proxy.
  const ip = getClientIp(request);
  const rl = checkRateLimit(`v1:register:${project.id}:${ip}`, RATE_LIMITS.auth);
  if (!rl.allowed) {
    return addCorsHeaders(NextResponse.json({ error: "Too many requests", resetIn: rl.resetIn }, { status: 429, headers: { "Retry-After": String(rl.resetIn) } }), request);
  }

  // -------------------------------------------------------------------------
  // STEP 3: Validate and create user
  // -------------------------------------------------------------------------
  let body: unknown;
  try { body = await request.json(); } catch {
    return addCorsHeaders(NextResponse.json({ error: "Invalid JSON" }, { status: 400 }), request);
  }

  const { email, password, name } = body as Record<string, unknown>;
  if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return addCorsHeaders(NextResponse.json({ error: "Valid email is required" }, { status: 400 }), request);
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return addCorsHeaders(NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 }), request);
  }

  // Check uniqueness WITHIN this project (same email can exist in other projects)
  const existing = await db.serviceUser.findUnique({
    where: { projectId_email: { projectId: project.id, email: email.toLowerCase() } },
  });
  if (existing) {
    return addCorsHeaders(NextResponse.json({ error: "A user with this email already exists in this project" }, { status: 409 }), request);
  }

  const passwordHash = await hashPassword(password);
  const user = await db.serviceUser.create({
    data: {
      projectId: project.id,
      email: email.toLowerCase(),
      passwordHash,
      name: (name as string) || null,
    },
  });

  // -------------------------------------------------------------------------
  // STEP 4: Return JWT token
  // -------------------------------------------------------------------------
  // The calling app stores this token and sends it back to verify the user.
  // We return it in the response body (not a cookie) because:
  // - The calling app is a server, not a browser
  // - The calling app decides how to store/distribute it (cookie, localStorage, etc.)
  const token = await createServiceToken({
    serviceUserId: user.id,
    projectId: project.id,
    email: user.email,
  });

  const response = NextResponse.json({
    message: "User registered successfully",
    token,  // <-- The calling app saves this
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
    },
  }, { status: 201 });

  return addCorsHeaders(response, request);
}
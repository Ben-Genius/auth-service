// POST /api/v1/auth/login — Authenticate an end-user via API key
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createServiceToken } from "@/lib/auth";
import { extractApiKey } from "@/lib/api-key";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { addCorsHeaders, handleCorsPreFlight } from "@/lib/cors";

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreFlight(request);
}

export async function POST(request: NextRequest) {
  // Authenticate via API key
  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return addCorsHeaders(NextResponse.json({ error: "Missing API key" }, { status: 401 }), request);
  }

  const project = await db.project.findUnique({ where: { apiKey } });
  if (!project) {
    return addCorsHeaders(NextResponse.json({ error: "Invalid API key" }, { status: 401 }), request);
  }

  // Rate limiting
  const ip = getClientIp(request);
  const rl = checkRateLimit(`v1:login:${project.id}:${ip}`, RATE_LIMITS.auth);
  if (!rl.allowed) {
    return addCorsHeaders(NextResponse.json({ error: "Too many login attempts", resetIn: rl.resetIn }, { status: 429, headers: { "Retry-After": String(rl.resetIn) } }), request);
  }

  // Parse input
  let body: unknown;
  try { body = await request.json(); } catch {
    return addCorsHeaders(NextResponse.json({ error: "Invalid JSON" }, { status: 400 }), request);
  }

  const { email, password } = body as Record<string, unknown>;
  if (!email || !password || typeof email !== "string" || typeof password !== "string") {
    return addCorsHeaders(NextResponse.json({ error: "Email and password are required" }, { status: 400 }), request);
  }

  // Find user within THIS project only
  const user = await db.serviceUser.findUnique({
    where: { projectId_email: { projectId: project.id, email: email.toLowerCase() } },
  });

  // Generic error to prevent user enumeration
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return addCorsHeaders(NextResponse.json({ error: "Invalid email or password" }, { status: 401 }), request);
  }

  const token = await createServiceToken({
    serviceUserId: user.id,
    projectId: project.id,
    email: user.email,
  });

  const response = NextResponse.json({
    message: "Login successful",
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
    },
  });

  return addCorsHeaders(response, request);
}
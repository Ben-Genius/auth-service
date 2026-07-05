// POST /api/portal/auth/login — Developer logs into the portal
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createPortalToken } from "@/lib/auth";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { addCorsHeaders, handleCorsPreFlight } from "@/lib/cors";

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreFlight(request);
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`portal:login:${ip}`, RATE_LIMITS.auth);
  if (!rl.allowed) {
    return addCorsHeaders(NextResponse.json({ error: "Too many login attempts", resetIn: rl.resetIn }, { status: 429, headers: { "Retry-After": String(rl.resetIn) } }), request);
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return addCorsHeaders(NextResponse.json({ error: "Invalid JSON" }, { status: 400 }), request);
  }

  const { email, password } = body as Record<string, unknown>;
  if (!email || !password || typeof email !== "string" || typeof password !== "string") {
    return addCorsHeaders(NextResponse.json({ error: "Email and password are required" }, { status: 400 }), request);
  }

  const developer = await db.developer.findUnique({ where: { email: email.toLowerCase() } });
  if (!developer || !(await verifyPassword(password, developer.passwordHash))) {
    return addCorsHeaders(NextResponse.json({ error: "Invalid email or password" }, { status: 401 }), request);
  }

  const token = await createPortalToken({ developerId: developer.id, email: developer.email });
  const response = NextResponse.json({
    message: "Login successful",
    developer: { id: developer.id, email: developer.email, name: developer.name },
  });

  response.cookies.set("portal-token", token, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24,
  });

  return addCorsHeaders(response, request);
}
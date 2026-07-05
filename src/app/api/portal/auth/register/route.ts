// POST /api/portal/auth/register — Developer signs up on the portal
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createPortalToken } from "@/lib/auth";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { addCorsHeaders, handleCorsPreFlight } from "@/lib/cors";

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreFlight(request);
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`portal:register:${ip}`, RATE_LIMITS.auth);
  if (!rl.allowed) {
    return addCorsHeaders(NextResponse.json({ error: "Too many requests", resetIn: rl.resetIn }, { status: 429, headers: { "Retry-After": String(rl.resetIn) } }), request);
  }

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

  const existing = await db.developer.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return addCorsHeaders(NextResponse.json({ error: "An account with this email already exists" }, { status: 409 }), request);
  }

  const passwordHash = await hashPassword(password);
  const developer = await db.developer.create({
    data: { email: email.toLowerCase(), passwordHash, name: (name as string) || null },
  });

  const token = await createPortalToken({ developerId: developer.id, email: developer.email });
  const response = NextResponse.json({
    message: "Developer account created",
    developer: { id: developer.id, email: developer.email, name: developer.name },
  }, { status: 201 });

  response.cookies.set("portal-token", token, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24,
  });

  return addCorsHeaders(response, request);
}
// GET /api/v1/auth/me — Verify a service token and return user info
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyServiceToken } from "@/lib/auth";
import { addCorsHeaders, handleCorsPreFlight } from "@/lib/cors";

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreFlight(request);
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return addCorsHeaders(NextResponse.json({ error: "Missing Bearer token" }, { status: 401 }), request);
  }

  const token = authHeader.slice(7);
  const payload = await verifyServiceToken(token);
  if (!payload) {
    return addCorsHeaders(NextResponse.json({ error: "Invalid or expired token" }, { status: 401 }), request);
  }

  const user = await db.serviceUser.findFirst({
    where: { id: payload.serviceUserId, projectId: payload.projectId },
    select: { id: true, email: true, name: true, emailVerified: true, createdAt: true },
  });

  if (!user) {
    return addCorsHeaders(NextResponse.json({ error: "User not found" }, { status: 404 }), request);
  }

  const response = NextResponse.json({ user, projectId: payload.projectId });
  return addCorsHeaders(response, request);
}
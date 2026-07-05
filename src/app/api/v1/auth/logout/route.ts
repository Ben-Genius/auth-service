// POST /api/v1/auth/logout — Invalidate a service token
// With JWTs, true invalidation requires a blacklist. For now, the calling
// app simply discards the token on their side.
import { NextRequest, NextResponse } from "next/server";
import { addCorsHeaders, handleCorsPreFlight } from "@/lib/cors";

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreFlight(request);
}

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ message: "Logged out. Discard the token on the client side." });
  return addCorsHeaders(response, request);
}
// POST /api/v1/auth/otp/verify — Verify an OTP code
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyServiceToken, verifyOtp } from "@/lib/auth";
import { extractApiKey } from "@/lib/api-key";
import { addCorsHeaders, handleCorsPreFlight } from "@/lib/cors";

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreFlight(request);
}

export async function POST(request: NextRequest) {
  // Same dual auth as /otp/send
  let projectId: string | null = null;
  let serviceUserId: string | null = null;

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ") && !authHeader.slice(7).startsWith("ak_")) {
    const payload = await verifyServiceToken(authHeader.slice(7));
    if (payload) {
      projectId = payload.projectId;
      serviceUserId = payload.serviceUserId;
    }
  }

  if (!projectId) {
    const apiKey = extractApiKey(request);
    if (!apiKey) {
      return addCorsHeaders(NextResponse.json({ error: "Authentication required" }, { status: 401 }), request);
    }
    const project = await db.project.findUnique({ where: { apiKey } });
    if (!project) return addCorsHeaders(NextResponse.json({ error: "Invalid API key" }, { status: 401 }), request);
    projectId = project.id;
  }

  // Parse OTP code
  let body: unknown;
  try { body = await request.json(); } catch {
    return addCorsHeaders(NextResponse.json({ error: "Invalid JSON" }, { status: 400 }), request);
  }

  const { code, userId } = body as Record<string, unknown>;
  if (!code || typeof code !== "string") {
    return addCorsHeaders(NextResponse.json({ error: "OTP code is required" }, { status: 400 }), request);
  }
  // If authed via API key, userId must be provided
  if (!serviceUserId) {
    if (!userId || typeof userId !== "string") {
      return addCorsHeaders(NextResponse.json({ error: "userId is required when using API key" }, { status: 400 }), request);
    }
    serviceUserId = userId;
  }

  // Find valid OTP
  const otp = await db.otp.findFirst({
    where: {
      projectId,
      userId: serviceUserId,
      purpose: "VERIFY_EMAIL",
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    return addCorsHeaders(NextResponse.json({ error: "No valid OTP found. Request a new one." }, { status: 400 }), request);
  }

  if (!(await verifyOtp(code, otp.code))) {
    return addCorsHeaders(NextResponse.json({ error: "Invalid OTP code" }, { status: 400 }), request);
  }

  // Mark used + verify email in a transaction
  await db.$transaction([
    db.otp.update({ where: { id: otp.id }, data: { used: true } }),
    db.serviceUser.update({
      where: { id: serviceUserId },
      data: { emailVerified: true },
    }),
  ]);

  // Issue a new token with updated emailVerified status
  const user = await db.serviceUser.findUnique({ where: { id: serviceUserId } });
  const { createServiceToken } = await import("@/lib/auth");
  const newToken = await createServiceToken({
    serviceUserId: serviceUserId,
    projectId,
    email: user!.email,
  });

  const response = NextResponse.json({
    message: "Email verified successfully",
    token: newToken,
    user: {
      id: user!.id,
      email: user!.email,
      name: user!.name,
      emailVerified: user!.emailVerified,
    },
  });

  return addCorsHeaders(response, request);
}
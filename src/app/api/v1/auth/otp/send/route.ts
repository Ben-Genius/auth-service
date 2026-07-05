// POST /api/v1/auth/otp/send — Send OTP (returned in response, no domain needed)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyServiceToken, generateOtpCode, hashOtp, getOtpExpiry } from "@/lib/auth";
import { extractApiKey } from "@/lib/api-key";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { addCorsHeaders, handleCorsPreFlight } from "@/lib/cors";

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreFlight(request);
}

export async function POST(request: NextRequest) {
  // Can authenticate via API key OR via existing service JWT
  let projectId: string | null = null;
  let serviceUserId: string | null = null;

  // Try service JWT first (user is already logged in)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ") && !authHeader.slice(7).startsWith("ak_")) {
    const payload = await verifyServiceToken(authHeader.slice(7));
    if (payload) {
      projectId = payload.projectId;
      serviceUserId = payload.serviceUserId;
    }
  }

  // Fall back to API key (the calling app requests OTP on behalf of the user)
  if (!projectId) {
    const apiKey = extractApiKey(request);
    if (!apiKey) {
      return addCorsHeaders(NextResponse.json({ error: "Authentication required (API key or service token)" }, { status: 401 }), request);
    }
    const project = await db.project.findUnique({ where: { apiKey } });
    if (!project) {
      return addCorsHeaders(NextResponse.json({ error: "Invalid API key" }, { status: 401 }), request);
    }
    projectId = project.id;

    // If using API key, the body must include the userId
    let body: unknown;
    try { body = await request.json(); } catch {
      return addCorsHeaders(NextResponse.json({ error: "Provide { userId } in the body when using API key" }, { status: 400 }), request);
    }
    serviceUserId = (body as Record<string, unknown>).userId as string;
    if (!serviceUserId) {
      return addCorsHeaders(NextResponse.json({ error: "userId is required when using API key" }, { status: 400 }), request);
    }
  }

  // Rate limiting
  const rl = checkRateLimit(`v1:otp:${projectId}:${serviceUserId}`, RATE_LIMITS.otp);
  if (!rl.allowed) {
    return addCorsHeaders(NextResponse.json({ error: "Too many OTP requests", resetIn: rl.resetIn }, { status: 429, headers: { "Retry-After": String(rl.resetIn) } }), request);
  }

  // Verify the user exists in this project
  const user = await db.serviceUser.findFirst({
    where: { id: serviceUserId!, projectId },
  });
  if (!user) {
    return addCorsHeaders(NextResponse.json({ error: "User not found" }, { status: 404 }), request);
  }

  // Generate and store OTP
  const plainCode = generateOtpCode();
  const hashedCode = await hashOtp(plainCode);
  const expiresAt = getOtpExpiry();

  // 🔍 DEBUG: Log plain code for testing
  console.log(`\n📧 OTP Code for ${user.email}: ${plainCode}`);

  await db.otp.deleteMany({
    where: { projectId, userId: serviceUserId!, used: false, expiresAt: { gt: new Date() } },
  });

  await db.otp.create({
    data: {
      projectId,
      userId: serviceUserId!,
      code: hashedCode,
      purpose: "VERIFY_EMAIL",
      expiresAt,
    },
  });

  // Return the OTP in the response.
  // This is the "no domain" approach: the calling app receives the code
  // and delivers it however it wants (email, SMS, in-app notification, etc.)
  const response = NextResponse.json({
    message: "OTP generated",
    code: plainCode,  // The calling app handles delivery ← Use this in your frontend!
    expiresIn: 600,   // seconds
  });
  
  return addCorsHeaders(response, request);
}
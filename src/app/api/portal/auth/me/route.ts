// GET /api/portal/auth/me — Get current developer
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPortalToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("portal-token")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const payload = await verifyPortalToken(token);
  if (!payload) return NextResponse.json({ error: "Session expired" }, { status: 401 });

  const developer = await db.developer.findUnique({
    where: { id: payload.developerId },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  if (!developer) return NextResponse.json({ error: "Developer not found" }, { status: 404 });
  return NextResponse.json({ developer });
}
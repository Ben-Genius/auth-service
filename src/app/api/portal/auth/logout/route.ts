// POST /api/portal/auth/logout
import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ message: "Logged out" });
  response.cookies.set("portal-token", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
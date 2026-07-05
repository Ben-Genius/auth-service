// GET /api/portal/projects — List developer's projects with user counts
// POST /api/portal/projects — Create a new project
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPortalToken } from "@/lib/auth";
import { generateApiKey } from "@/lib/api-key";

async function getDeveloper(request: NextRequest) {
  const token = request.cookies.get("portal-token")?.value;
  if (!token) return null;
  const payload = await verifyPortalToken(token);
  if (!payload) return null;
  return payload;
}

export async function GET(request: NextRequest) {
  const dev = await getDeveloper(request);
  if (!dev) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const projects = await db.project.findMany({
    where: { developerId: dev.developerId },
    include: { _count: { select: { serviceUsers: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      apiKey: p.apiKey,
      userCount: p._count.serviceUsers,
      createdAt: p.createdAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  const dev = await getDeveloper(request);
  if (!dev) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name } = body as Record<string, unknown>;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 });
  }

  const apiKey = generateApiKey();
  const project = await db.project.create({
    data: { name: name.trim(), developerId: dev.developerId, apiKey },
  });

  return NextResponse.json({
    message: "Project created",
    project: { id: project.id, name: project.name, apiKey: project.apiKey, createdAt: project.createdAt },
  }, { status: 201 });
}
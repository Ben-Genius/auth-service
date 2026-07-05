import { headers } from "next/headers";
import { auth } from "./auth";

export async function getSession() {
  const hdrs = await headers();
  return auth.api.getSession({ headers: hdrs });
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

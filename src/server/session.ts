import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

export const SUPPORT_SESSION_COOKIE = "support_session_id";

export async function getSessionId() {
  const cookieStore = await cookies();
  return cookieStore.get(SUPPORT_SESSION_COOKIE)?.value ?? null;
}

export async function ensureSessionId() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(SUPPORT_SESSION_COOKIE)?.value;

  if (existing) {
    return existing;
  }

  const sessionId = randomUUID();
  cookieStore.set(SUPPORT_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });

  return sessionId;
}

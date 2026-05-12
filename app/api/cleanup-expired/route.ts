import { NextResponse } from "next/server";
import { cleanupExpiredSessions } from "@/lib/session-store";

export const runtime = "nodejs";

export async function POST() {
  const result = await cleanupExpiredSessions();
  return NextResponse.json({ ok: true, data: result });
}

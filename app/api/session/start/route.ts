import { NextResponse } from "next/server";
import { createSession } from "@/lib/session-store";

export const runtime = "nodejs";

export async function POST() {
  const session = await createSession();
  return NextResponse.json({
    ok: true,
    data: {
      sessionId: session.id,
      expiresAt: session.expiresAt,
    },
  });
}

import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/session-store";
import { assertSessionId } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { sessionId?: string };
    const sessionId = assertSessionId(body.sessionId);
    await deleteSession(sessionId);
    return NextResponse.json({ ok: true, data: { reset: true } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "초기화에 실패했습니다." },
      { status: 400 },
    );
  }
}

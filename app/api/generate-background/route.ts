import { NextResponse } from "next/server";
import { addCostLine } from "@/lib/costs";
import { generateBackground } from "@/lib/openai";
import { checkRateLimit } from "@/lib/rate-limit";
import { readSession, updateSession } from "@/lib/session-store";
import { writeSessionFile } from "@/lib/storage";
import { validateSelectedKeywords } from "@/lib/keywords";
import { assertSessionId } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(request, "generate-background", { limit: 12, windowMs: 60_000 });
    if (!rate.ok) {
      return NextResponse.json(
        { ok: false, error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

    const body = (await request.json()) as { sessionId?: string; selectedKeywords?: unknown };
    const sessionId = assertSessionId(body.sessionId);
    await readSession(sessionId);
    const selectedKeywords = validateSelectedKeywords(body.selectedKeywords);
    const { buffer, usedFallback, costLine } = await generateBackground(selectedKeywords);
    await writeSessionFile(sessionId, "background.png", buffer);
    await updateSession(sessionId, (session) => {
      session.selectedKeywords = selectedKeywords;
      session.files.background = "background.png";
      addCostLine(session, costLine);
      session.state = "background_ready";
    });

    return NextResponse.json({
      ok: true,
      data: {
        backgroundUrl: `/api/session/${sessionId}/file/background.png`,
        usedFallback,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "배경 생성에 실패했습니다." },
      { status: 400 },
    );
  }
}

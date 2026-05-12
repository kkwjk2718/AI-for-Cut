import { NextResponse } from "next/server";
import { addCostLine } from "@/lib/costs";
import { generateBackground } from "@/lib/openai";
import { updateSession } from "@/lib/session-store";
import { writeSessionFile } from "@/lib/storage";
import { validateSelectedKeywords } from "@/lib/keywords";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { sessionId?: string; selectedKeywords?: unknown };
    const selectedKeywords = validateSelectedKeywords(body.selectedKeywords);
    const { buffer, usedFallback, costLine } = await generateBackground(selectedKeywords);
    await writeSessionFile(body.sessionId ?? "", "background.png", buffer);
    await updateSession(body.sessionId ?? "", (session) => {
      session.selectedKeywords = selectedKeywords;
      session.files.background = "background.png";
      addCostLine(session, costLine);
      session.state = "background_ready";
    });

    return NextResponse.json({
      ok: true,
      data: {
        backgroundUrl: `/api/session/${body.sessionId}/file/background.png`,
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

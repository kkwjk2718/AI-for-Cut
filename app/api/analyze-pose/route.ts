import { NextResponse } from "next/server";
import { addCostLine } from "@/lib/costs";
import { assertImagePixelLimit } from "@/lib/image-compose";
import { analyzePose, prepareAnalysisImage } from "@/lib/openai";
import { checkRateLimit } from "@/lib/rate-limit";
import { readSession, updateSession } from "@/lib/session-store";
import { writeSessionFile } from "@/lib/storage";
import { assertSessionId, parseDataUrl } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(request, "analyze-pose", { limit: 20, windowMs: 60_000 });
    if (!rate.ok) {
      return NextResponse.json(
        { ok: false, error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

    const body = (await request.json()) as { sessionId?: string; imageDataUrl?: string };
    const sessionId = assertSessionId(body.sessionId);
    await readSession(sessionId);
    const { buffer } = parseDataUrl(body.imageDataUrl);
    await assertImagePixelLimit(buffer);
    const analysisImage = await prepareAnalysisImage(buffer);
    const { analysis, costLine } = await analyzePose(analysisImage);

    await writeSessionFile(sessionId, "analysis.jpg", analysisImage);
    await updateSession(sessionId, (session) => {
      session.files.analysisImage = "analysis.jpg";
      session.recommendations = analysis;
      addCostLine(session, costLine);
      session.state = "keywords_ready";
    });

    return NextResponse.json({ ok: true, data: { analysis } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "포즈 분석에 실패했습니다." },
      { status: 400 },
    );
  }
}

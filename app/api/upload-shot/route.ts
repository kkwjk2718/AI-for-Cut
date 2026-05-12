import { NextResponse } from "next/server";
import { assertForegroundHasAlpha, assertImagePixelLimit, normalizeShotForBooth } from "@/lib/image-compose";
import { checkRateLimit } from "@/lib/rate-limit";
import { readSession, updateSession } from "@/lib/session-store";
import { writeSessionFile } from "@/lib/storage";
import { assertSessionId, assertShotIndex, parseDataUrl } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(request, "upload-shot", { limit: 60, windowMs: 60_000 });
    if (!rate.ok) {
      return NextResponse.json(
        { ok: false, error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

    const body = (await request.json()) as {
      sessionId?: string;
      index?: number;
      imageDataUrl?: string;
    };
    const sessionId = assertSessionId(body.sessionId);
    await readSession(sessionId);
    const index = assertShotIndex(body.index);
    const { buffer } = parseDataUrl(body.imageDataUrl);
    await assertImagePixelLimit(buffer);
    await assertForegroundHasAlpha(buffer);
    const normalized = await normalizeShotForBooth(buffer);
    const fileName = `shot-${index}.png`;
    await writeSessionFile(sessionId, fileName, normalized);
    const session = await updateSession(sessionId, (draft) => {
      draft.files.shots[index - 1] = fileName;
      if (draft.files.shots.filter(Boolean).length === 4) {
        draft.state = "photos_captured";
      }
    });

    return NextResponse.json({
      ok: true,
      data: {
        uploaded: true,
        completedShots: session.files.shots.filter(Boolean).length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "사진 업로드에 실패했습니다." },
      { status: 400 },
    );
  }
}

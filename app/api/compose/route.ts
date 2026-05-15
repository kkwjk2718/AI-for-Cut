import { NextResponse } from "next/server";
import { archiveFinalImage } from "@/lib/admin-store";
import { DEFAULT_FRAME_COLOR_ID, getFrameColorOption, type FrameColorId } from "@/lib/frame-colors";
import { composeFourCut } from "@/lib/image-compose";
import { checkRateLimit } from "@/lib/rate-limit";
import { readSession, updateSession } from "@/lib/session-store";
import { readSessionFile, writeSessionFile } from "@/lib/storage";
import { assertSessionId } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(request, "compose", { limit: 20, windowMs: 60_000 });
    if (!rate.ok) {
      return NextResponse.json(
        { ok: false, error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

    const body = (await request.json()) as { sessionId?: string; frameColorId?: string };
    const sessionId = assertSessionId(body.sessionId);
    const frameColorId = getFrameColorOption(body.frameColorId).id as FrameColorId;
    const session = await readSession(sessionId);
    if (!session.files.background) {
      throw new Error("배경 이미지가 없습니다.");
    }
    if (session.files.shots.filter(Boolean).length !== 4) {
      throw new Error("네 장의 사진이 필요합니다.");
    }

    const background = await readSessionFile(sessionId, session.files.background);
    const shots = await Promise.all(
      session.files.shots.slice(0, 4).map((fileName) => readSessionFile(sessionId, fileName)),
    );
    const finalImage = await composeFourCut(background, shots, frameColorId || DEFAULT_FRAME_COLOR_ID);
    await writeSessionFile(sessionId, "final.png", finalImage);
    const updatedSession = await updateSession(sessionId, (draft) => {
      draft.files.final = "final.png";
      draft.state = "composited";
    });
    await archiveFinalImage(updatedSession, finalImage);

    return NextResponse.json({
      ok: true,
      data: {
        finalUrl: `/api/session/${sessionId}/file/final.png`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "이미지 합성에 실패했습니다." },
      { status: 400 },
    );
  }
}

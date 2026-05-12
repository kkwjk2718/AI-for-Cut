import { NextResponse } from "next/server";
import { normalizeShotForBooth } from "@/lib/image-compose";
import { updateSession } from "@/lib/session-store";
import { writeSessionFile } from "@/lib/storage";
import { assertShotIndex, parseDataUrl } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      index?: number;
      imageDataUrl?: string;
    };
    const index = assertShotIndex(body.index);
    const { buffer } = parseDataUrl(body.imageDataUrl);
    const normalized = await normalizeShotForBooth(buffer);
    const fileName = `shot-${index}.png`;
    await writeSessionFile(body.sessionId ?? "", fileName, normalized);
    const session = await updateSession(body.sessionId ?? "", (draft) => {
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

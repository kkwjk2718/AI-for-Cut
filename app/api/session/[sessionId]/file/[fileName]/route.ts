import { NextResponse } from "next/server";
import { readSession } from "@/lib/session-store";
import { readSessionFile } from "@/lib/storage";
import { assertSessionId } from "@/lib/validators";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  "analysis.jpg": "image/jpeg",
  "background.png": "image/png",
  "final.png": "image/png",
  "shot-1.png": "image/png",
  "shot-2.png": "image/png",
  "shot-3.png": "image/png",
  "shot-4.png": "image/png",
};

export async function GET(
  _request: Request,
  context: { params: { sessionId: string; fileName: string } | Promise<{ sessionId: string; fileName: string }> },
) {
  try {
    const { sessionId, fileName } = await Promise.resolve(context.params);
    const safeSessionId = assertSessionId(sessionId);
    if (!CONTENT_TYPES[fileName]) {
      throw new Error("지원하지 않는 파일입니다.");
    }

    await readSession(safeSessionId);
    const buffer = await readSessionFile(safeSessionId, fileName);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": CONTENT_TYPES[fileName],
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "파일을 찾을 수 없습니다." },
      { status: 404 },
    );
  }
}

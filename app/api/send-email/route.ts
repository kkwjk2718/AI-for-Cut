import { NextResponse } from "next/server";
import { markAdminEmailSent } from "@/lib/admin-store";
import { sendPhotoEmail } from "@/lib/brevo";
import { deleteSession, readSession, updateSession } from "@/lib/session-store";
import { readSessionFile } from "@/lib/storage";
import { assertSessionId, isEmail } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { sessionId?: string; email?: string };
    const sessionId = assertSessionId(body.sessionId);
    if (!isEmail(body.email)) {
      throw new Error("이메일 주소를 확인해 주세요.");
    }

    const session = await readSession(sessionId);
    if (!session.files.final) {
      throw new Error("완성된 이미지가 없습니다.");
    }

    const image = await readSessionFile(sessionId, session.files.final);
    const result = await sendPhotoEmail({
      to: body.email,
      image,
      fileName: "ai-4cut.png",
    });

    await updateSession(sessionId, (draft) => {
      draft.state = "emailed";
      draft.emailSentAt = new Date().toISOString();
    });
    await markAdminEmailSent(sessionId, {
      skipped: result.skipped,
      hasMessageId: Boolean(result.messageId),
    });
    await deleteSession(sessionId);

    return NextResponse.json({
      ok: true,
      data: {
        sent: result.success,
        skipped: result.skipped,
        messageId: result.messageId,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "메일 전송에 실패했습니다." },
      { status: 400 },
    );
  }
}

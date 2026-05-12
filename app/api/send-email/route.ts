import { NextResponse } from "next/server";
import sharp from "sharp";
import { markAdminEmailSent } from "@/lib/admin-store";
import { sendPhotoEmail } from "@/lib/brevo";
import { checkRateLimit } from "@/lib/rate-limit";
import { deleteSession, readSession, updateSession } from "@/lib/session-store";
import { readSessionFile } from "@/lib/storage";
import { assertSessionId, isEmail } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(request, "send-email", { limit: 10, windowMs: 60_000 });
    if (!rate.ok) {
      return NextResponse.json(
        { ok: false, error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

    const body = (await request.json()) as { sessionId?: string; email?: string; skip?: boolean };
    const sessionId = assertSessionId(body.sessionId);
    const session = await readSession(sessionId);

    if (!session.files.final) {
      throw new Error("완성된 이미지가 없습니다.");
    }

    if (body.skip === true) {
      await updateSession(sessionId, (draft) => {
        draft.state = "emailed";
        draft.emailSentAt = new Date().toISOString();
      });
      await markAdminEmailSent(sessionId, {
        skipped: true,
        hasMessageId: false,
      });
      await deleteSession(sessionId);

      return NextResponse.json({
        ok: true,
        data: {
          sent: false,
          skipped: true,
        },
      });
    }

    if (!isEmail(body.email)) {
      throw new Error("이메일 주소를 확인해 주세요.");
    }

    const image = await sharp(await readSessionFile(sessionId, session.files.final))
      .jpeg({ quality: 97, chromaSubsampling: "4:4:4", mozjpeg: true })
      .toBuffer();
    const result = await sendPhotoEmail({
      to: body.email,
      image,
      fileName: "gshs-ai-4cut-hq.jpg",
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

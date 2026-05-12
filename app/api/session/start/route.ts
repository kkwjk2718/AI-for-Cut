import { NextResponse } from "next/server";
import { createSession } from "@/lib/session-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      privacyConsentAccepted?: boolean;
      archiveImageConsent?: boolean;
    };

    if (body.privacyConsentAccepted !== true) {
      return NextResponse.json(
        { ok: false, error: "개인정보 수집 및 이용 동의가 필요합니다." },
        { status: 400 },
      );
    }

    const session = await createSession({
      archiveImageConsent: body.archiveImageConsent === true,
    });
    return NextResponse.json({
      ok: true,
      data: {
        sessionId: session.id,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "세션을 시작하지 못했습니다." },
      { status: 400 },
    );
  }
}

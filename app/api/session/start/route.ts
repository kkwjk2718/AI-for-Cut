import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSession } from "@/lib/session-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(request, "session-start", { limit: 20, windowMs: 60_000 });
    if (!rate.ok) {
      return NextResponse.json(
        { ok: false, error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

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

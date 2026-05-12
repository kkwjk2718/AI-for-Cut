import { NextResponse } from "next/server";
import { isAdminCookieHeaderAuthenticated } from "@/lib/admin-auth";
import { readAdminImage } from "@/lib/admin-store";
import { assertSessionId } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: { recordId: string } | Promise<{ recordId: string }> },
) {
  try {
    if (!isAdminCookieHeaderAuthenticated(request.headers.get("cookie"))) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { recordId } = await Promise.resolve(context.params);
    const safeRecordId = assertSessionId(recordId);
    const buffer = await readAdminImage(safeRecordId);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Image not found." },
      { status: 404 },
    );
  }
}

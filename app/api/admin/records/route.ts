import { NextResponse } from "next/server";
import { isAdminCookieHeaderAuthenticated } from "@/lib/admin-auth";
import { readAdminRecords } from "@/lib/admin-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAdminCookieHeaderAuthenticated(request.headers.get("cookie"))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const records = await readAdminRecords();
  return NextResponse.json({ ok: true, data: { records } });
}

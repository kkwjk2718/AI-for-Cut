import { NextResponse } from "next/server";
import { ADMIN_COOKIE, createAdminToken, hasAdminPin, verifyAdminPin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!hasAdminPin()) {
    return NextResponse.json({ ok: false, error: "ADMIN_PIN is not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { pin?: string };
  if (!verifyAdminPin(body.pin)) {
    return NextResponse.json({ ok: false, error: "PIN을 확인해 주세요." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, data: { authenticated: true } });
  response.cookies.set(ADMIN_COOKIE, createAdminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}

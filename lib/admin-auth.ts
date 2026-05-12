import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "ai4cut_admin";

function configuredPin(): string | undefined {
  const pin = process.env.ADMIN_PIN?.trim();
  if (pin) {
    return pin;
  }
  return process.env.NODE_ENV === "production" ? undefined : "0000";
}

function tokenForPin(pin: string): string {
  return `v1.${createHmac("sha256", pin).update("ai4cut-admin").digest("hex")}`;
}

export function hasAdminPin(): boolean {
  return Boolean(configuredPin());
}

export function hasExplicitAdminPin(): boolean {
  return Boolean(process.env.ADMIN_PIN?.trim());
}

export function verifyAdminPin(pin: unknown): boolean {
  const expected = configuredPin();
  return typeof pin === "string" && Boolean(expected) && pin === expected;
}

export function createAdminToken(): string {
  const pin = configuredPin();
  if (!pin) {
    throw new Error("ADMIN_PIN is not configured.");
  }
  return tokenForPin(pin);
}

export function verifyAdminToken(token: string | undefined): boolean {
  const pin = configuredPin();
  if (!pin || !token) {
    return false;
  }

  const expected = tokenForPin(pin);
  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);
  return tokenBuffer.length === expectedBuffer.length && timingSafeEqual(tokenBuffer, expectedBuffer);
}

export async function isAdminCookieAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifyAdminToken(store.get(ADMIN_COOKIE)?.value);
}

export function isAdminCookieHeaderAuthenticated(cookieHeader: string | null): boolean {
  if (!cookieHeader) {
    return false;
  }

  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_COOKIE}=`))
    ?.slice(ADMIN_COOKIE.length + 1);

  return verifyAdminToken(token ? decodeURIComponent(token) : undefined);
}

"use client";

import { LogOut } from "lucide-react";

export function AdminLogoutButton() {
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => undefined);
    window.location.href = "/admin/login";
  }

  return (
    <button
      type="button"
      onClick={() => void logout()}
      className="flex min-h-[72px] items-center justify-center gap-3 rounded-[22px] bg-white/12 px-6 text-2xl font-black text-white"
    >
      <LogOut className="h-7 w-7" />
      로그아웃
    </button>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole, X } from "lucide-react";

export function AdminLogin({ pinConfigured }: { pinConfigured: boolean }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "PIN을 확인해 주세요.");
      }
      window.location.href = "/admin";
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "로그인에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  function append(value: string) {
    setPin((current) => `${current}${value}`.slice(0, 12));
  }

  return (
    <main className="kiosk-root">
      <div className="kiosk-screen grid place-items-center p-10 text-white">
        <form onSubmit={submit} className="grid w-full max-w-[720px] gap-7 rounded-[18px] border border-white/10 bg-white/[0.06] p-10">
          <div className="grid gap-4 text-center">
            <LockKeyhole className="mx-auto h-20 w-20 text-[#5eead4]" />
            <h1 className="text-6xl font-black">관리자 로그인</h1>
            <p className="text-2xl font-bold text-white/62">
              {pinConfigured ? "운영자 PIN을 입력해 주세요." : "프로덕션에서는 ADMIN_PIN 설정이 필요합니다. 개발 기본 PIN은 0000입니다."}
            </p>
          </div>

          <div className="flex h-24 items-center justify-between rounded-[14px] border border-white/12 bg-black/28 px-6">
            <div className="flex gap-4">
              {Array.from({ length: 4 }, (_, index) => (
                <span
                  key={index}
                  className={`grid h-12 w-12 place-items-center rounded-full border text-3xl font-black ${
                    pin.length > index ? "border-[#5eead4] bg-[#5eead4] text-[#050505]" : "border-white/18 bg-white/5 text-transparent"
                  }`}
                >
                  •
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPin("")}
              className="flex h-16 w-16 items-center justify-center rounded-[10px] bg-white/10"
              aria-label="PIN 지우기"
            >
              <X className="h-8 w-8" />
            </button>
          </div>

          {error && <p className="rounded-[18px] bg-[#fb7185]/20 p-4 text-center text-2xl font-black text-[#fda4af]">{error}</p>}

          <div className="grid grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((number) => (
              <button
                key={number}
                type="button"
                onClick={() => append(number)}
              className={number === "0" ? "col-start-2 min-h-[84px] rounded-[12px] bg-white/10 text-4xl font-black" : "min-h-[84px] rounded-[12px] bg-white/10 text-4xl font-black"}
              >
                {number}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={!pin || submitting}
            className="min-h-[96px] rounded-[12px] bg-[#5eead4] text-4xl font-black text-[#050505] disabled:bg-white/10 disabled:text-white/30"
          >
            {submitting ? "확인 중" : "관리자 열기"}
          </button>
        </form>
      </div>
    </main>
  );
}

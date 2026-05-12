"use client";

interface CountdownProps {
  value: number | null;
  label?: string | null;
  variant?: "prep" | "shutter";
}

export function Countdown({ value, label, variant = "prep" }: CountdownProps) {
  if (!value) {
    return null;
  }

  if (variant === "shutter") {
    return (
      <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-black/38 backdrop-blur-[1px]">
        <div className="grid place-items-center gap-3 text-center" aria-live="assertive">
          <div className="rounded-[4px] border-[3px] border-[#f04438] bg-[#f04438] px-7 py-2 text-3xl font-black text-[#f4f1e8]">
            {label ?? "촬영"}
          </div>
          <div className="text-[180px] font-black leading-none text-[#f4f1e8] drop-shadow-[0_8px_28px_rgba(0,0,0,0.72)]">
            {value}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-[#050505]/92 backdrop-blur-sm">
      <div
        className="grid min-w-[560px] place-items-center gap-6 rounded-[4px] border-[4px] border-[#f4f1e8] bg-[#0b0b0b] px-12 py-10 text-center shadow-[0_0_80px_rgba(244,241,232,0.12)]"
        aria-live="assertive"
      >
        <div className="rounded-[4px] border-[3px] border-[#f4f1e8]/70 px-6 py-2 text-2xl font-black tracking-[0.22em] text-[#f4f1e8]/72">
          POSE READY
        </div>
        {label && <div className="text-5xl font-black text-[#f4f1e8]">{label}</div>}
        <div className="flex h-56 w-56 items-center justify-center rounded-full border-[8px] border-[#f4f1e8] bg-transparent text-[138px] font-black leading-none text-[#f4f1e8]">
          {value}
        </div>
        <p className="text-3xl font-black text-[#f4f1e8]/62">자세를 바꾸고 화면을 바라봐 주세요</p>
      </div>
    </div>
  );
}

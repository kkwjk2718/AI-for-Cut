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
      <div className="pointer-events-none absolute inset-0 z-30">
        <div className="absolute right-4 top-4 grid place-items-center gap-1.5 text-center" aria-live="assertive">
          <div className="rounded-[4px] bg-[#f04438] px-4 py-1.5 text-xl font-black text-[#f4f1e8] shadow-[0_8px_28px_rgba(0,0,0,0.42)]">
            {label ?? "촬영"}
          </div>
          <div className="grid h-24 w-24 place-items-center rounded-full border-[5px] border-[#f04438] bg-[#050505]/58 text-[62px] font-black leading-none text-[#f4f1e8] shadow-[0_10px_34px_rgba(0,0,0,0.48)]">
            {value}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none w-full">
      <div
        className="grid grid-cols-[1fr_108px] items-center gap-5 rounded-[8px] border border-[#5eead4]/44 bg-[#151515] px-5 py-4 text-left shadow-[0_18px_48px_rgba(0,0,0,0.34)]"
        aria-live="assertive"
      >
        <div className="min-w-0">
          <div className="text-base font-black tracking-[0.18em] text-[#5eead4]">READY</div>
          {label && <div className="mt-1 text-3xl font-black text-[#f4f1e8]">{label}</div>}
          <p className="mt-2 safe-text text-lg font-black leading-snug text-[#f4f1e8]/62">
            화면을 보면서 자세를 맞춰 주세요.
          </p>
        </div>
        <div className="grid h-[108px] w-[108px] place-items-center rounded-full border-[5px] border-[#5eead4] bg-[#050505] text-[64px] font-black leading-none text-[#f4f1e8]">
          {value}
        </div>
      </div>
    </div>
  );
}

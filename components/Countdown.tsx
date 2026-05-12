"use client";

interface CountdownProps {
  value: number | null;
  label?: string | null;
}

export function Countdown({ value, label }: CountdownProps) {
  if (!value) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/82">
      <div className="grid place-items-center gap-5 text-center">
        {label && <div className="text-4xl font-black text-[#f4f1e8]">{label}</div>}
        <div className="flex h-44 w-44 items-center justify-center rounded-full border-[6px] border-[#f4f1e8] bg-[#f4f1e8] text-8xl font-black text-[#050505]">
          {value}
        </div>
      </div>
    </div>
  );
}

"use client";

import { Loader2 } from "lucide-react";

interface LoadingScreenProps {
  title: string;
  detail?: string;
}

export function LoadingScreen({ title, detail }: LoadingScreenProps) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-5 rounded-[8px] border-2 border-booth-ink bg-white p-8 text-center shadow-panel">
      <Loader2 className="h-11 w-11 animate-spin text-booth-cyan" />
      <div className="grid gap-2">
        <h2 className="safe-text text-2xl font-black">{title}</h2>
        {detail && <p className="safe-text text-sm font-semibold text-booth-ink/70">{detail}</p>}
      </div>
    </div>
  );
}

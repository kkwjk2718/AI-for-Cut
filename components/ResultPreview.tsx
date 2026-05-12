"use client";

import { Mail, RotateCcw } from "lucide-react";

interface ResultPreviewProps {
  finalUrl: string;
  onEmail: () => void;
  onRestart: () => void;
}

export function ResultPreview({ finalUrl, onEmail, onRestart }: ResultPreviewProps) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(280px,420px)_1fr]">
      <div className="rounded-[8px] border-2 border-booth-ink bg-white p-3 shadow-panel">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={finalUrl} alt="완성된 AI 네컷 이미지" className="h-auto w-full rounded-[6px]" />
      </div>
      <div className="flex flex-col justify-center gap-4">
        <h2 className="safe-text text-3xl font-black">네컷 이미지가 완성되었습니다</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onEmail}
            className="flex min-h-12 items-center justify-center gap-2 rounded-[8px] border-2 border-booth-ink bg-booth-mint px-4 font-black text-white"
          >
            <Mail className="h-5 w-5" />
            이메일로 받기
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="flex min-h-12 items-center justify-center gap-2 rounded-[8px] border-2 border-booth-ink bg-white px-4 font-black"
          >
            <RotateCcw className="h-5 w-5" />
            처음부터 다시
          </button>
        </div>
      </div>
    </div>
  );
}

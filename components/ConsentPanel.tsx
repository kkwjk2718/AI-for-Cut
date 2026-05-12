"use client";

import { Check } from "lucide-react";

interface ConsentPanelProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function ConsentPanel({ checked, onCheckedChange }: ConsentPanelProps) {
  return (
    <div className="grid gap-4">
      <div className="rounded-[8px] border-2 border-booth-ink bg-white p-5 shadow-panel">
        <ul className="grid gap-3 text-sm leading-6 text-booth-ink">
          <li>사진과 이메일은 이미지 생성 및 발송 목적으로만 사용합니다.</li>
          <li>메일 발송이 끝나면 세션 파일은 즉시 삭제됩니다.</li>
          <li>오류 대응을 위해 실패 세션은 최대 24시간 안에 자동 삭제됩니다.</li>
        </ul>
      </div>
      <label className="flex cursor-pointer items-center gap-3 rounded-[8px] border-2 border-booth-ink bg-booth-paper p-4 font-semibold">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border-2 border-booth-ink bg-white">
          {checked && <Check className="h-5 w-5" />}
        </span>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="sr-only"
        />
        안내 내용을 확인했습니다
      </label>
    </div>
  );
}

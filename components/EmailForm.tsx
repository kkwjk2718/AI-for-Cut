"use client";

import { useMemo, useState } from "react";
import { Delete, Mail, Send, X } from "lucide-react";

interface EmailFormProps {
  disabled?: boolean;
  layout?: "portrait" | "landscape";
  onSubmit: (email: string) => Promise<void>;
}

const LETTER_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

const NUMBER_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const SYMBOL_KEYS = ["@", ".", "_", "-"];
const QUICK_KEYS = ["@gmail.com", "@naver.com", "@kakao.com", "@daum.net", ".com", ".kr"];

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

export function EmailForm({ disabled, layout = "portrait", onSubmit }: EmailFormProps) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const valid = useMemo(() => isEmail(email), [email]);
  const isLandscape = layout === "landscape";

  function append(value: string) {
    if (disabled || submitting) {
      return;
    }
    setConfirming(false);
    setEmail((current) => `${current}${value}`.slice(0, 254));
  }

  function appendQuick(value: string) {
    if (disabled || submitting) {
      return;
    }
    setConfirming(false);
    setEmail((current) => {
      if (!value.startsWith("@")) {
        return `${current}${value}`.slice(0, 254);
      }

      const domain = value.slice(1);
      const local = current.includes("@") ? current.split("@")[0] : current;
      if (!local) {
        return current;
      }
      return `${local}@${domain}`.slice(0, 254);
    });
  }

  function backspace() {
    setConfirming(false);
    setEmail((current) => current.slice(0, -1));
  }

  async function submit() {
    if (!valid || disabled || submitting) {
      return;
    }
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(email);
    } finally {
      setSubmitting(false);
    }
  }

  const keyClass = `flex items-center justify-center rounded-[6px] border-[3px] border-[#12325b] bg-white px-3 font-black text-[#12325b] active:translate-y-[2px] disabled:opacity-45 ${
    isLandscape ? "min-h-[58px] text-xl" : "min-h-[74px] text-2xl"
  }`;

  return (
    <div className={`grid text-[#12325b] ${isLandscape ? "min-h-0 gap-4" : "gap-6"}`}>
      <div className="rounded-[8px] border-[3px] border-[#12325b] bg-white p-5">
        <div className="flex items-center gap-4">
          <Mail className="h-9 w-9" />
          <input
            aria-label="이메일"
            value={email}
            readOnly
            disabled={disabled || submitting}
            placeholder="email@example.com"
            className={`min-w-0 flex-1 bg-transparent font-black text-[#12325b] outline-none placeholder:text-[#12325b]/32 ${
              isLandscape ? "h-16 text-3xl" : "h-20 text-4xl"
            }`}
          />
          <button
            type="button"
            onClick={() => {
              setConfirming(false);
              setEmail("");
            }}
            disabled={disabled || submitting || email.length === 0}
            className="flex h-14 w-14 items-center justify-center rounded-[6px] border-[3px] border-[#12325b] bg-white disabled:opacity-35"
            aria-label="입력 지우기"
          >
            <X className="h-7 w-7" />
          </button>
        </div>
        {email && !valid && (
          <p className="mt-3 text-xl font-black text-[#b42318]">이메일 주소 형식을 확인해 주세요</p>
        )}
      </div>

      <div className={`grid ${isLandscape ? "gap-2" : "gap-3"}`}>
        <div className="grid grid-cols-10 gap-2">
          {NUMBER_KEYS.map((key) => (
            <button key={key} type="button" className={keyClass} onClick={() => append(key)}>
              {key}
            </button>
          ))}
        </div>

        {LETTER_ROWS.map((row, rowIndex) => (
          <div
            key={row.join("")}
            className={`grid gap-2 ${
              rowIndex === 0 ? "grid-cols-10" : rowIndex === 1 ? "grid-cols-9 px-8" : "grid-cols-7 px-24"
            }`}
          >
            {row.map((key) => (
              <button key={key} type="button" className={keyClass} onClick={() => append(key)}>
                {key}
              </button>
            ))}
          </div>
        ))}

        <div className="grid grid-cols-6 gap-2">
          {SYMBOL_KEYS.map((key) => (
            <button key={key} type="button" className={keyClass} onClick={() => append(key)}>
              {key}
            </button>
          ))}
          <button type="button" className={`${keyClass} col-span-2`} onClick={backspace}>
            <Delete className="h-7 w-7" />
          </button>
        </div>

        <div className="grid grid-cols-6 gap-2">
          {QUICK_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={`rounded-[6px] border-[3px] border-[#12325b] bg-[#12325b] font-black text-white active:translate-y-[2px] ${
                isLandscape ? "min-h-[56px] text-lg" : "min-h-[70px] text-xl"
              }`}
              onClick={() => appendQuick(key)}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      {confirming && (
        <div className="grid gap-4 rounded-[8px] border-[3px] border-[#12325b] bg-white p-5 text-center">
          <p className="text-2xl font-black text-[#12325b]/60">이 주소로 보낼까요?</p>
          <p className="safe-text break-all text-4xl font-black text-[#12325b]">{email}</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="min-h-[68px] rounded-[6px] border-[3px] border-[#12325b] bg-white text-2xl font-black text-[#12325b] active:translate-y-[2px]"
            >
              수정하기
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting}
              className="min-h-[68px] rounded-[6px] border-[3px] border-[#12325b] bg-[#12325b] text-2xl font-black text-white active:translate-y-[2px] disabled:opacity-45"
            >
              전송하기
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={!valid || disabled || submitting}
        className={`flex items-center justify-center gap-4 rounded-[8px] border-[3px] border-[#12325b] bg-[#12325b] px-8 font-black text-white active:translate-y-[2px] disabled:cursor-not-allowed disabled:border-[#12325b]/30 disabled:bg-[#12325b]/16 disabled:text-[#12325b]/36 ${
          isLandscape ? "min-h-[86px] text-3xl" : "min-h-[108px] text-4xl"
        }`}
      >
        <Send className="h-9 w-9" />
        {submitting ? "전송 중" : confirming ? "주소 확인 중" : "메일로 받기"}
      </button>
    </div>
  );
}

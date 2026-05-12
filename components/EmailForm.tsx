"use client";

import { useMemo, useState } from "react";
import { Delete, Mail, Send, X } from "lucide-react";

interface EmailFormProps {
  disabled?: boolean;
  layout?: "portrait" | "landscape";
  onSubmit: (email: string) => Promise<void>;
  onSkip: () => Promise<void>;
}

type InputMode = "local" | "domain";
type DomainMode = "preset" | "custom";

const LETTER_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

const NUMBER_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const LOCAL_SYMBOL_KEYS = [".", "_", "-"];
const DOMAIN_SYMBOL_KEYS = [".", "-"];
const DOMAIN_OPTIONS = ["gmail.com", "naver.com", "kakao.com", "daum.net"];

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function isDomain(value: string): boolean {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(value);
}

export function EmailForm({ disabled, layout = "portrait", onSubmit, onSkip }: EmailFormProps) {
  const [localPart, setLocalPart] = useState("");
  const [presetDomain, setPresetDomain] = useState(DOMAIN_OPTIONS[0]);
  const [customDomain, setCustomDomain] = useState("");
  const [domainMode, setDomainMode] = useState<DomainMode>("preset");
  const [inputMode, setInputMode] = useState<InputMode>("local");
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const isLandscape = layout === "landscape";
  const domain = domainMode === "custom" ? customDomain : presetDomain;
  const email = localPart && domain ? `${localPart}@${domain}` : "";
  const valid = useMemo(() => {
    return /^[a-z0-9._-]+$/.test(localPart) && isDomain(domain) && isEmail(email);
  }, [domain, email, localPart]);
  const busy = Boolean(disabled || submitting || skipping);

  function append(value: string) {
    if (busy) {
      return;
    }
    setConfirming(false);
    if (inputMode === "domain") {
      setDomainMode("custom");
      setCustomDomain((current) => `${current}${value}`.slice(0, 120));
      return;
    }
    setLocalPart((current) => `${current}${value}`.slice(0, 120));
  }

  function backspace() {
    if (busy) {
      return;
    }
    setConfirming(false);
    if (inputMode === "domain") {
      setCustomDomain((current) => current.slice(0, -1));
      return;
    }
    setLocalPart((current) => current.slice(0, -1));
  }

  function clearAll() {
    setConfirming(false);
    setLocalPart("");
    setCustomDomain("");
    setDomainMode("preset");
    setPresetDomain(DOMAIN_OPTIONS[0]);
    setInputMode("local");
  }

  function chooseDomain(value: string) {
    if (busy) {
      return;
    }
    setConfirming(false);
    setPresetDomain(value);
    setDomainMode("preset");
    setInputMode("local");
  }

  function chooseCustomDomain() {
    if (busy) {
      return;
    }
    setConfirming(false);
    setDomainMode("custom");
    setInputMode("domain");
  }

  async function submit() {
    if (!valid || busy) {
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

  async function skip() {
    if (busy) {
      return;
    }
    setSkipping(true);
    try {
      await onSkip();
    } finally {
      setSkipping(false);
    }
  }

  const keyClass = `flex items-center justify-center rounded-[6px] border-[3px] border-[#12325b] bg-white px-3 font-black text-[#12325b] active:translate-y-[2px] disabled:opacity-45 ${
    isLandscape ? "min-h-[54px] text-xl" : "min-h-[74px] text-2xl"
  }`;
  const symbolKeys = inputMode === "domain" ? DOMAIN_SYMBOL_KEYS : LOCAL_SYMBOL_KEYS;

  return (
    <div className={`grid text-[#12325b] ${isLandscape ? "min-h-0 gap-4" : "gap-6"}`}>
      <div className="rounded-[8px] border-[3px] border-[#12325b] bg-white p-5">
        <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-3">
          <button
            type="button"
            onClick={() => setInputMode("local")}
            className={`h-16 min-w-0 rounded-[6px] border-[3px] px-4 text-left text-3xl font-black ${
              inputMode === "local" ? "border-[#12325b] bg-[#e9f0fb]" : "border-[#12325b]/25 bg-white"
            }`}
          >
            <span className="safe-text block truncate text-[#12325b]">{localPart || "아이디"}</span>
          </button>
          <span className="text-4xl font-black">@</span>
          <button
            type="button"
            onClick={() => {
              if (domainMode === "custom") {
                setInputMode("domain");
              }
            }}
            className={`h-16 min-w-0 rounded-[6px] border-[3px] px-4 text-left text-3xl font-black ${
              inputMode === "domain" ? "border-[#12325b] bg-[#e9f0fb]" : "border-[#12325b]/25 bg-white"
            }`}
          >
            <span className="safe-text block truncate text-[#12325b]">{domain || "도메인"}</span>
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={busy || (!localPart && !customDomain && domainMode === "preset")}
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

      <div className="grid grid-cols-5 gap-2">
        {DOMAIN_OPTIONS.map((option) => {
          const active = domainMode === "preset" && presetDomain === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => chooseDomain(option)}
              className={`min-h-[58px] rounded-[6px] border-[3px] px-2 text-xl font-black active:translate-y-[2px] ${
                active ? "border-[#12325b] bg-[#12325b] text-white" : "border-[#12325b] bg-white text-[#12325b]"
              }`}
            >
              {option}
            </button>
          );
        })}
        <button
          type="button"
          onClick={chooseCustomDomain}
          className={`min-h-[58px] rounded-[6px] border-[3px] px-2 text-xl font-black active:translate-y-[2px] ${
            domainMode === "custom" ? "border-[#12325b] bg-[#12325b] text-white" : "border-[#12325b] bg-white text-[#12325b]"
          }`}
        >
          직접 입력
        </button>
      </div>

      {domainMode === "custom" && (
        <p className="rounded-[6px] border-[3px] border-[#12325b] bg-white px-5 py-3 text-center text-xl font-black">
          도메인 직접 입력 중
        </p>
      )}

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
          {symbolKeys.map((key) => (
            <button key={key} type="button" className={keyClass} onClick={() => append(key)}>
              {key}
            </button>
          ))}
          <button
            type="button"
            className={`${keyClass} ${symbolKeys.length === 2 ? "col-span-4" : "col-span-3"}`}
            onClick={backspace}
          >
            <Delete className="h-7 w-7" />
          </button>
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

      <div className="grid grid-cols-[1fr_260px] gap-3">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!valid || busy}
          className={`flex items-center justify-center gap-4 rounded-[8px] border-[3px] border-[#12325b] bg-[#12325b] px-8 font-black text-white active:translate-y-[2px] disabled:cursor-not-allowed disabled:border-[#12325b]/30 disabled:bg-[#12325b]/16 disabled:text-[#12325b]/36 ${
            isLandscape ? "min-h-[82px] text-3xl" : "min-h-[108px] text-4xl"
          }`}
        >
          <Send className="h-9 w-9" />
          {submitting ? "전송 중" : confirming ? "주소 확인 중" : "메일로 받기"}
        </button>
        <button
          type="button"
          onClick={() => void skip()}
          disabled={busy}
          className={`flex items-center justify-center gap-3 rounded-[8px] border-[3px] border-[#12325b] bg-white px-5 font-black text-[#12325b] active:translate-y-[2px] disabled:opacity-40 ${
            isLandscape ? "min-h-[82px] text-2xl" : "min-h-[108px] text-3xl"
          }`}
        >
          <Mail className="h-8 w-8" />
          {skipping ? "처리 중" : "건너뛰기"}
        </button>
      </div>
    </div>
  );
}

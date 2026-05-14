"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Delete, Mail, Send, X } from "lucide-react";

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
  const [localCursor, setLocalCursor] = useState(0);
  const [domainCursor, setDomainCursor] = useState(0);
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
      setCustomDomain((current) => {
        const next = (current.slice(0, domainCursor) + value + current.slice(domainCursor)).slice(0, 120);
        return next;
      });
      setDomainCursor((c) => Math.min(c + value.length, 120));
      return;
    }
    setLocalPart((current) => {
      const next = (current.slice(0, localCursor) + value + current.slice(localCursor)).slice(0, 120);
      return next;
    });
    setLocalCursor((c) => Math.min(c + value.length, 120));
  }

  function backspace() {
    if (busy) {
      return;
    }
    setConfirming(false);
    if (inputMode === "domain") {
      if (domainCursor === 0) {
        return;
      }
      setCustomDomain((current) => current.slice(0, domainCursor - 1) + current.slice(domainCursor));
      setDomainCursor((c) => Math.max(0, c - 1));
      return;
    }
    if (localCursor === 0) {
      return;
    }
    setLocalPart((current) => current.slice(0, localCursor - 1) + current.slice(localCursor));
    setLocalCursor((c) => Math.max(0, c - 1));
  }

  function moveCursor(dir: -1 | 1) {
    if (inputMode === "domain") {
      setDomainCursor((c) => Math.max(0, Math.min(customDomain.length, c + dir)));
      return;
    }
    setLocalCursor((c) => Math.max(0, Math.min(localPart.length, c + dir)));
  }

  function clearAll() {
    setConfirming(false);
    setLocalPart("");
    setCustomDomain("");
    setDomainMode("preset");
    setPresetDomain(DOMAIN_OPTIONS[0]);
    setInputMode("local");
    setLocalCursor(0);
    setDomainCursor(0);
  }

  function chooseDomain(value: string) {
    if (busy) {
      return;
    }
    setConfirming(false);
    setPresetDomain(value);
    setDomainMode("preset");
    setInputMode("local");
    setLocalCursor(localPart.length);
  }

  function chooseCustomDomain() {
    if (busy) {
      return;
    }
    setConfirming(false);
    setDomainMode("custom");
    setInputMode("domain");
    setDomainCursor(customDomain.length);
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

  function renderInputText(value: string, cursor: number, active: boolean, placeholder: string) {
    const textClass = inputTextClass(active, Boolean(value));
    if (!active || !value) {
      return <span className={`safe-text block truncate ${textClass}`}>{value || placeholder}</span>;
    }
    const before = value.slice(0, cursor);
    const after = value.slice(cursor);
    return (
      <span className={`safe-text block truncate ${textClass}`}>
        {before}
        <span className="animate-pulse text-[var(--primary)]">|</span>
        {after}
      </span>
    );
  }

  const keyClass = `flex items-center justify-center rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3 font-black text-[var(--text)] active:translate-y-[2px] disabled:opacity-45 ${
    isLandscape ? "min-h-[54px] text-xl" : "min-h-[74px] text-2xl"
  }`;
  const inputBoxClass = (active: boolean) =>
    `h-16 min-w-0 rounded-[6px] border-[3px] px-4 text-left text-3xl font-black active:translate-y-[2px] ${
      active
        ? "border-[var(--primary)] bg-[rgba(94,234,212,0.10)] shadow-[inset_0_0_0_1px_rgba(94,234,212,0.22),0_0_24px_rgba(94,234,212,0.10)]"
        : "border-[var(--line-soft)] bg-[var(--surface-2)]"
    }`;
  const inputTextClass = (active: boolean, hasValue: boolean) =>
    active ? (hasValue ? "text-[var(--text)]" : "text-[var(--text-subtle)]") : hasValue ? "text-[var(--text-muted)]" : "text-[var(--text-subtle)]";
  const symbolKeys = inputMode === "domain" ? DOMAIN_SYMBOL_KEYS : LOCAL_SYMBOL_KEYS;

  return (
    <div className={`grid text-[var(--text)] ${isLandscape ? "min-h-0 gap-4" : "gap-6"}`}>
      <div className="rounded-[8px] border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-3">
          <button
            type="button"
            onClick={() => { setInputMode("local"); setLocalCursor(localPart.length); }}
            className={inputBoxClass(inputMode === "local")}
          >
            {renderInputText(localPart, localCursor, inputMode === "local", "아이디")}
          </button>
          <span className="text-4xl font-black text-[var(--primary)]">@</span>
          <button
            type="button"
            onClick={() => {
              if (domainMode === "custom") {
                setInputMode("domain");
                setDomainCursor(customDomain.length);
              }
            }}
            className={inputBoxClass(inputMode === "domain")}
          >
            {renderInputText(domainMode === "custom" ? customDomain : presetDomain, domainCursor, inputMode === "domain", "도메인")}
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={busy || (!localPart && !customDomain && domainMode === "preset")}
            className="flex h-14 w-14 items-center justify-center rounded-[6px] border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] disabled:opacity-35"
            aria-label="입력 지우기"
          >
            <X className="h-7 w-7" />
          </button>
        </div>
        {email && !valid && (
          <p className="mt-3 text-xl font-black text-[var(--danger)]">이메일 주소 형식을 확인해 주세요</p>
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
                active ? "border-[var(--primary)] bg-[rgba(94,234,212,0.12)] text-[var(--primary)]" : "border-[var(--line)] bg-transparent text-[var(--text)]"
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
            domainMode === "custom" ? "border-[var(--primary)] bg-[rgba(94,234,212,0.12)] text-[var(--primary)]" : "border-[var(--line)] bg-transparent text-[var(--text)]"
          }`}
        >
          직접 입력
        </button>
      </div>

      {domainMode === "custom" && (
        <p className="rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-5 py-3 text-center text-xl font-black text-[var(--text-muted)]">
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

        <div className="grid grid-cols-8 gap-2">
          {symbolKeys.map((key) => (
            <button key={key} type="button" className={keyClass} onClick={() => append(key)}>
              {key}
            </button>
          ))}
          <button type="button" className={keyClass} onClick={() => moveCursor(-1)}>
            <ChevronLeft className="h-7 w-7" />
          </button>
          <button type="button" className={keyClass} onClick={() => moveCursor(1)}>
            <ChevronRight className="h-7 w-7" />
          </button>
          <button
            type="button"
            className={`${keyClass} ${symbolKeys.length === 2 ? "col-span-3" : "col-span-2"}`}
            onClick={backspace}
          >
            <Delete className="h-7 w-7" />
          </button>
        </div>
      </div>

      {confirming && (
        <div className="grid gap-4 rounded-[8px] border border-[var(--primary)] bg-[var(--surface)] p-5 text-center">
          <p className="text-2xl font-black text-[var(--text-muted)]">이 주소로 보낼까요?</p>
          <p className="safe-text break-all text-4xl font-black text-[var(--primary)]">{email}</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="min-h-[68px] rounded-[6px] border border-[var(--line)] bg-transparent text-2xl font-black text-[var(--text)] active:translate-y-[2px]"
            >
              수정하기
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting}
              className="min-h-[68px] rounded-[6px] border border-[var(--primary)] bg-[var(--primary)] text-2xl font-black text-[var(--primary-text)] active:translate-y-[2px] disabled:opacity-45"
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
          className={`flex items-center justify-center gap-4 rounded-[8px] border border-[var(--primary)] bg-[var(--primary)] px-8 font-black text-[var(--primary-text)] active:translate-y-[2px] disabled:cursor-not-allowed disabled:border-[var(--line-soft)] disabled:bg-[var(--surface)] disabled:text-[var(--text-subtle)] ${
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
          className={`flex items-center justify-center gap-3 rounded-[8px] border border-[var(--line)] bg-transparent px-5 font-black text-[var(--text)] active:translate-y-[2px] disabled:opacity-40 ${
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

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  Check,
  Home,
  Mail,
  RotateCcw,
  Sparkles,
  Tags,
  Wand2,
} from "lucide-react";
import { CameraGuideOverlay, CameraPreview, type CameraPreviewHandle } from "./CameraPreview";
import { Countdown } from "./Countdown";
import { EmailForm } from "./EmailForm";
import { applyBeautyFilter, BEAUTY_OPTIONS, type BeautyStrength } from "@/lib/client-beauty";
import { removeBackgroundDataUrl } from "@/lib/client-segmentation";
import type { ApiResponse, KeywordCategory, PoseAnalysis, SelectedKeywords } from "@/lib/types";

type Step =
  | "idle"
  | "consent"
  | "analysis_help"
  | "analysis_capture"
  | "background_loading"
  | "capture"
  | "analysis_loading"
  | "tag_select"
  | "select_photos"
  | "uploading"
  | "compose"
  | "result"
  | "email"
  | "complete";

type BackgroundStatus = "idle" | "generating" | "ready" | "error";
type BeautyPreviewStatus = "idle" | "processing" | "ready" | "error";
type CountdownMode = "prep" | "shutter";

const CATEGORIES: KeywordCategory[] = ["theme", "mood", "color", "effect"];
const DETAIL_CATEGORIES: KeywordCategory[] = ["mood", "color", "effect"];
const CATEGORY_LABELS: Record<KeywordCategory, string> = {
  theme: "장소",
  mood: "느낌",
  color: "색",
  effect: "장식",
};
const EVENT_TITLE = "2026. 진주시와 함께하는 경남과학고등학교 수학, 과학, 정보 페스티벌";
const EVENT_TITLE_FRAME_LINES = ["2026. 진주시와 함께하는 경남과학고등학교", "수학, 과학, 정보 페스티벌"];
const BOOTH_NAME = "AI와 함께하는 수과정페 네컷";
const CLUB_NAME = "이음(IEUM)";
const CLUB_SLOGAN = "- 기술로 사람과 사람을 잇다";
const STAGE_LABELS = ["시작", "AI추천", "촬영", "선택", "받기"];
const BACKGROUND_STAGES = [
  "선택한 분위기 정리",
  "과학축제 배경 설계",
  "빛과 장식 생성",
  "네컷 합성 준비",
];
const FINAL_CAPTURE_COUNT = 6;
const PREP_COUNTDOWN_VALUES = [5, 4, 3, 2, 1];
const COUNTDOWN_VALUES = [3, 2, 1];
const FREE_CAPTURE_READY_TEXT = "화면을 보면서 자유롭게 준비해 주세요";
const FREE_CAPTURE_SHUTTER_TEXT = "곧 촬영합니다. 화면을 계속 봐 주세요";
const SHUTTER_FLASH_MS = 240;
const POSE_EXAMPLES = ["브이", "손하트", "양손 번쩍", "생각하는 포즈"];

const STEP_STAGE: Record<Step, number> = {
  idle: 0,
  consent: 0,
  analysis_help: 1,
  analysis_capture: 1,
  capture: 2,
  analysis_loading: 1,
  tag_select: 1,
  background_loading: 3,
  select_photos: 3,
  uploading: 3,
  compose: 4,
  result: 4,
  email: 4,
  complete: 4,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function postJson<T>(url: string, body?: unknown, timeoutMs = 70_000): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const payload = (await response.json()) as ApiResponse<T>;
    if (!payload.ok) {
      throw new Error(payload.error);
    }
    return payload.data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("요청 시간이 초과되었습니다. 네트워크 상태를 확인하고 다시 시도해 주세요.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function defaultKeywords(analysis: PoseAnalysis): SelectedKeywords {
  return CATEGORIES.reduce((acc, category) => {
    acc[category] = analysis.recommended_keywords[category][0];
    return acc;
  }, {} as SelectedKeywords);
}

function conceptTitle(selection: SelectedKeywords | null): string {
  if (!selection) {
    return BOOTH_NAME;
  }
  return `${selection.color} ${selection.effect} ${selection.theme}`;
}

function conceptStory(selection: SelectedKeywords | null): string {
  if (!selection) {
    return "포즈에 어울리는 과학축제 배경을 만듭니다.";
  }
  return `${selection.mood} 느낌의 ${selection.theme} 배경에 ${selection.effect} 장식을 더합니다.`;
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function demoPhotoDataUrl(index: number): string {
  const colors = ["#0f766e", "#1d4ed8", "#7c3aed", "#be123c", "#047857", "#c2410c"];
  const color = colors[index % colors.length];
  return svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
      <rect width="900" height="1200" fill="#101010"/>
      <rect x="70" y="70" width="760" height="1060" rx="20" fill="${color}"/>
      <circle cx="450" cy="365" r="118" fill="#f3c7a7"/>
      <path d="M315 330c40-120 228-116 270 0 20-40 8-114-44-150-52-36-145-42-213 0-58 36-70 104-13 150z" fill="#101010"/>
      <rect x="275" y="515" width="350" height="390" rx="150" fill="#f4f1e8"/>
      <path d="M295 575c-70 38-118 118-132 218" stroke="#f4f1e8" stroke-width="54" stroke-linecap="round"/>
      <path d="M605 575c70 38 118 118 132 218" stroke="#f4f1e8" stroke-width="54" stroke-linecap="round"/>
      <text x="450" y="1050" fill="#f4f1e8" font-family="Arial" font-size="54" font-weight="800" text-anchor="middle">${index + 1}/6</text>
    </svg>
  `);
}

function demoFinalDataUrl(): string {
  const cells = [0, 1, 2, 3]
    .map((index) => {
      const x = index % 2 === 0 ? 120 : 1240;
      const y = index < 2 ? 170 : 1710;
      const hue = ["#0f766e", "#1d4ed8", "#7c3aed", "#be123c"][index];
      return `
        <rect x="${x}" y="${y}" width="1000" height="1320" fill="${hue}"/>
        <circle cx="${x + 500}" cy="${y + 380}" r="120" fill="#f3c7a7"/>
        <rect x="${x + 320}" y="${y + 560}" width="360" height="440" rx="160" fill="#f4f1e8"/>
      `;
    })
    .join("");
  return svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="2400" height="3600" viewBox="0 0 2400 3600">
      <rect width="2400" height="3600" fill="#050505"/>
      ${cells}
      <text x="1200" y="3290" fill="#f4f1e8" font-family="Arial" font-size="58" font-weight="800" text-anchor="middle">${EVENT_TITLE_FRAME_LINES[0]}</text>
      <text x="1200" y="3370" fill="#f4f1e8" font-family="Arial" font-size="58" font-weight="800" text-anchor="middle">${EVENT_TITLE_FRAME_LINES[1]}</text>
      <text x="1200" y="3460" fill="#5eead4" font-family="Arial" font-size="44" font-weight="800" text-anchor="middle">AI TYPE: 초록 홀로그램 과학자</text>
    </svg>
  `);
}

const DEMO_ANALYSIS: PoseAnalysis = {
  people_count: 1,
  pose_summary: "정면을 바라보며 미래 연구소를 발견한 듯한 포즈",
  ui_caption: "차분하지만 미래적인 연구자 느낌이에요.",
  recommended_keywords: {
    theme: ["우주", "심해기지", "크리스탈동굴", "정글", "사이버거리", "도서관"],
    mood: ["미래적인", "지적인", "신비로운", "역동적인"],
    color: ["초록", "검정", "네온", "흰색"],
    effect: ["홀로그램", "빛줄기", "별빛", "수식"],
  },
};

const DEMO_SELECTION: SelectedKeywords = {
  theme: "우주",
  mood: "미래적인",
  color: "초록",
  effect: "홀로그램",
};

function KioskButton({
  children,
  onClick,
  disabled,
  tone = "primary",
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "primary" | "secondary" | "danger";
  className?: string;
}) {
  const classes = {
    primary: "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-text)] shadow-[0_0_36px_rgba(94,234,212,0.14)]",
    secondary: "border-[var(--line)] bg-transparent text-[var(--text)]",
    danger: "border-[var(--danger)] bg-[var(--danger)] text-white",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-[96px] items-center justify-center gap-4 rounded-[6px] border-[2px] px-8 text-4xl font-black active:translate-y-[2px] disabled:cursor-not-allowed disabled:opacity-35 ${classes[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

function KioskHeader({ step, onRestart }: { step: Step; onRestart: () => void }) {
  const activeStage = STEP_STAGE[step];

  return (
    <header className="grid h-[96px] shrink-0 grid-cols-[1fr_auto] items-center border-b border-[var(--line-soft)] bg-[var(--bg)] px-9 text-[var(--text)]">
      <div className="flex min-w-0 items-center gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/ieum-logo.png" alt="IEUM" className="h-12 w-24 object-contain" />
        <div className="min-w-0">
          <p className="safe-text truncate text-xl font-black">{EVENT_TITLE}</p>
          <p className="safe-text truncate text-sm font-black tracking-[0.18em] text-[var(--text-subtle)]">
            {CLUB_NAME} {CLUB_SLOGAN}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {step !== "idle" && (
          <div className="flex items-center gap-3" aria-label="진행 단계">
            {STAGE_LABELS.map((label, index) => (
              <div
                key={label}
                className={`flex h-10 min-w-[86px] items-center justify-center rounded-full border px-3 text-sm font-black ${
                  index === activeStage
                    ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-text)]"
                    : index < activeStage
                      ? "border-[var(--line-soft)] bg-[var(--surface)] text-[var(--text-muted)]"
                      : "border-[var(--line-soft)] bg-transparent text-[var(--text-subtle)]"
                }`}
              >
                {index + 1} {label}
              </div>
            ))}
          </div>
        )}
        {step !== "idle" && step !== "complete" && (
          <button
            type="button"
            onClick={onRestart}
            className="flex h-16 w-16 items-center justify-center rounded-[6px] border-2 border-[var(--line)] bg-transparent text-[var(--text)] active:translate-y-[2px]"
            aria-label="처음으로"
          >
            <Home className="h-8 w-8" />
          </button>
        )}
      </div>
    </header>
  );
}

function StepTitle({
  eyebrow,
  title,
  detail,
  right,
  compact = false,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  right?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="flex items-end justify-between gap-8 border-b border-[var(--line)] pb-5 text-[var(--text)]">
      <div className="grid gap-1">
        <p className="text-xl font-black tracking-[0.18em] text-[var(--primary)]">{eyebrow}</p>
        <h2 className={`safe-text font-black leading-[1.05] ${compact ? "text-5xl" : "text-6xl"}`}>{title}</h2>
        {detail && <p className="safe-text max-w-[980px] text-2xl font-bold text-[var(--text-muted)]">{detail}</p>}
      </div>
      {right}
    </div>
  );
}

function LoadingPanel({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="grid h-full place-items-center text-center text-[#f4f1e8]">
      <div className="grid gap-7">
        <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-[4px] border-[#f4f1e8] bg-transparent">
          {icon}
        </div>
        <div className="grid gap-3">
          <h2 className="safe-text text-6xl font-black">{title}</h2>
          <p className="safe-text text-3xl font-bold text-[#f4f1e8]/62">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function ErrorPanel({ message, onRetry, onRestart }: { message: string; onRetry: () => void; onRestart: () => void }) {
  return (
    <div className="mx-auto grid max-w-[920px] gap-6 rounded-[4px] border-[3px] border-[#f04438] bg-[#0b0b0b] p-8 text-[#f4f1e8]">
      <div className="flex items-start gap-5">
        <AlertTriangle className="mt-1 h-12 w-12 shrink-0 text-[#f04438]" />
        <div className="grid gap-2">
          <h2 className="text-4xl font-black">일시적인 문제가 생겼습니다</h2>
          <p className="safe-text text-2xl font-bold text-[#f4f1e8]/68">{message}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <KioskButton onClick={onRetry} tone="primary">
          <RotateCcw className="h-10 w-10" />
          다시 시도
        </KioskButton>
        <KioskButton onClick={onRestart} tone="secondary">
          <Home className="h-10 w-10" />
          처음으로
        </KioskButton>
      </div>
    </div>
  );
}

function FramePreviewMockup() {
  return (
    <div className="grid w-[600px] gap-5 rounded-[6px] border-2 border-[var(--line-strong)] bg-[var(--bg)] p-7">
      <div className="grid grid-cols-2 gap-5">
        {[1, 2, 3, 4].map((index) => (
          <div
            key={index}
            className="grid aspect-[3/4] place-items-center bg-[var(--text)] text-[var(--primary-text)]"
          >
            <span className="text-3xl font-black">{index}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[84px_1fr_110px] items-center gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/school-mark.png" alt="경남과학고등학교" className="h-20 w-20 rounded-full bg-[#f4f1e8] object-cover" />
        <div className="text-center">
          {EVENT_TITLE_FRAME_LINES.map((line) => (
            <p key={line} className="safe-text text-sm font-black leading-tight text-[var(--text)]">
              {line}
            </p>
          ))}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/keuni-deuri-hands.png" alt="크니 드리" className="h-20 w-[110px] object-contain" />
      </div>
    </div>
  );
}

function CompositingFramePreview({
  photos,
  title = "AI가 배경을 입히는 중",
  compact = false,
}: {
  photos: Array<string | undefined>;
  title?: string;
  compact?: boolean;
}) {
  const slots = Array.from({ length: 4 }, (_, index) => photos[index]);
  const shellClass = compact ? "max-w-[350px]" : "max-w-[520px]";
  const panelClass = compact ? "gap-2.5 p-3" : "gap-4 p-5";
  const gridGapClass = compact ? "gap-2.5" : "gap-4";
  const logoClass = compact ? "h-10 w-10" : "h-16 w-16";
  const characterClass = compact ? "h-10 w-[66px]" : "h-16 w-[92px]";

  return (
    <div className={`ai-composite-shell mx-auto w-full ${shellClass} rounded-[10px] p-[5px]`}>
      <div className={`relative grid ${panelClass} rounded-[6px] bg-[#050505] text-[var(--text)]`}>
        <div className={`${compact ? "left-4 top-4 px-3 py-1.5 text-xs" : "left-5 top-5 px-4 py-2 text-sm"} absolute z-20 rounded-[4px] bg-[#050505]/74 font-black tracking-[0.16em] text-[var(--primary)]`}>
          AI COMPOSITING
        </div>
        <div className={`grid grid-cols-2 ${gridGapClass}`}>
          {slots.map((src, index) => (
            <div key={index} className="relative aspect-[3/4] overflow-hidden rounded-[4px] bg-[#063d34]">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={`${index + 1}번째 합성 대기 사진`} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-4xl font-black text-[var(--text-subtle)]">{index + 1}</div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,transparent_0,transparent_46%,rgba(5,5,5,0.18)_100%)]" />
            </div>
          ))}
        </div>
        <div className={`${compact ? "grid-cols-[40px_1fr_66px] gap-2.5" : "grid-cols-[64px_1fr_92px] gap-4"} grid items-center`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/school-mark.png" alt="경남과학고등학교" className={`${logoClass} rounded-full bg-[#f4f1e8] object-cover`} />
          <div className="text-center">
            {EVENT_TITLE_FRAME_LINES.map((line) => (
              <p key={line} className={`${compact ? "text-[10px]" : "text-xs"} safe-text font-black leading-tight text-[var(--text)]`}>
                {line}
              </p>
            ))}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/keuni-deuri-hands.png" alt="크니 드리" className={`${characterClass} object-contain`} />
        </div>
        <p className={`${compact ? "text-base" : "text-xl"} safe-text rounded-[4px] bg-[#f4f1e8]/8 px-4 py-3 text-center font-black text-[var(--text)]`}>
          {title}
        </p>
      </div>
    </div>
  );
}

function BeautySelector({
  value,
  onChange,
}: {
  value: BeautyStrength;
  onChange: (value: BeautyStrength) => void;
}) {
  return (
    <div className="grid gap-4 rounded-[6px] border border-[var(--line-soft)] bg-[var(--surface)] p-5 text-[var(--text)]">
      <div className="flex items-end justify-between gap-4">
        <div className="grid gap-1">
          <p className="text-lg font-black tracking-[0.18em] text-[var(--text-subtle)]">사진 설정</p>
          <h3 className="text-3xl font-black">얼굴 보정</h3>
        </div>
        <span className="rounded-[4px] bg-[var(--primary)] px-4 py-2 text-xl font-black text-[var(--primary-text)]">
          {BEAUTY_OPTIONS.find((option) => option.value === value)?.caption}
        </span>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {BEAUTY_OPTIONS.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`grid min-h-[82px] content-center gap-1 rounded-[4px] border-[2px] px-2 text-center active:translate-y-[2px] ${
                active
                  ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-text)]"
                  : "border-[var(--line)] bg-transparent text-[var(--text)]"
              }`}
            >
              <span className="text-xl font-black">{option.label}</span>
              <span className={`text-base font-black ${active ? "text-[#050505]/70" : "text-[var(--text-muted)]"}`}>
                {option.caption}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CaptureRail({ captured, activeIndex, count }: { captured: string[]; activeIndex: number; count: number }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
      {Array.from({ length: count }, (_, index) => {
        const src = captured[index];
        return (
          <div
            key={index}
            className={`relative aspect-[3/4] overflow-hidden rounded-[3px] border-[3px] ${
              activeIndex === index + 1 ? "border-[#f4f1e8]" : "border-[#f4f1e8]/38"
            }`}
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={`${index + 1}번 촬영 사진`} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center bg-[#111] text-xl font-black text-[#f4f1e8]/45">
                {index + 1}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BackgroundProgress({
  status,
  progress,
  error,
  compact = false,
}: {
  status: BackgroundStatus;
  progress: number;
  error: string | null;
  compact?: boolean;
}) {
  const activeStage = Math.min(BACKGROUND_STAGES.length - 1, Math.floor((progress / 100) * BACKGROUND_STAGES.length));

  if (compact) {
    return (
      <div className="grid gap-2 rounded-[6px] border border-[var(--line-soft)] bg-[var(--surface)] p-4 text-[var(--text)]">
        <div className="flex items-center justify-between gap-4">
          <p className="safe-text text-xl font-black">
            {status === "ready" ? "AI 배경 준비 완료" : status === "error" ? "AI 배경 생성 실패" : "AI가 배경을 만드는 중"}
          </p>
          <p className="text-2xl font-black text-[var(--primary)]">{status === "ready" ? "100%" : `${Math.round(progress)}%`}</p>
        </div>
        <div className="ai-progress-track h-3 overflow-hidden rounded-full bg-[#f4f1e8]/12">
          <div className="ai-progress-fill h-full rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        {error && <p className="safe-text text-lg font-black text-[var(--danger)]">{error}</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-4 rounded-[6px] border border-[var(--line-soft)] bg-[var(--surface)] p-5 text-[var(--text)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-lg font-black tracking-[0.18em] text-[var(--text-subtle)]">AI 합성</p>
          <h3 className="text-3xl font-black">
            {status === "ready" ? "배경 준비 완료" : status === "error" ? "배경 생성 실패" : "AI가 배경을 만드는 중"}
          </h3>
        </div>
        <div className="text-3xl font-black text-[var(--primary)]">{status === "ready" ? "100%" : `${Math.round(progress)}%`}</div>
      </div>

      <div className="ai-progress-track h-4 overflow-hidden rounded-full bg-[#f4f1e8]/12">
        <div className="ai-progress-fill h-full rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>

      {error ? (
        <p className="safe-text text-xl font-black text-[var(--danger)]">{error}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {BACKGROUND_STAGES.map((label, index) => (
            <div
              key={label}
              className={`ai-generation-step rounded-[4px] border-2 px-4 py-3 text-lg font-black ${
                index <= activeStage
                  ? "is-active border-[var(--line)] text-[var(--text)]"
                  : "border-[var(--line-soft)] text-[var(--text-subtle)]"
              }`}
            >
              <span className="ai-generation-dot" aria-hidden="true" />
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BoothApp() {
  const cameraRef = useRef<CameraPreviewHandle | null>(null);
  const captureStartedRef = useRef(false);
  const flowRunRef = useRef(0);
  const beautyRunRef = useRef(0);
  const [step, setStep] = useState<Step>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [countdownLabel, setCountdownLabel] = useState<string | null>(null);
  const [countdownMode, setCountdownMode] = useState<CountdownMode | null>(null);
  const [cameraFlash, setCameraFlash] = useState(false);
  const [analysisHelpSeconds, setAnalysisHelpSeconds] = useState(10);
  const [analysisPhoto, setAnalysisPhoto] = useState<string | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [beautifiedPhotos, setBeautifiedPhotos] = useState<string[]>([]);
  const [beautyPreviewStatus, setBeautyPreviewStatus] = useState<BeautyPreviewStatus>("idle");
  const [beautyPreviewError, setBeautyPreviewError] = useState<string | null>(null);
  const [shotIndex, setShotIndex] = useState(1);
  const [shotStatus, setShotStatus] = useState("카메라를 준비하고 있습니다");
  const [analysis, setAnalysis] = useState<PoseAnalysis | null>(null);
  const [tagSelection, setTagSelection] = useState<SelectedKeywords | null>(null);
  const [selectedPhotoIndices, setSelectedPhotoIndices] = useState<number[]>([]);
  const [beautyStrength, setBeautyStrength] = useState<BeautyStrength>(2);
  const [requiredConsentAccepted, setRequiredConsentAccepted] = useState(false);
  const [archiveImageConsent, setArchiveImageConsent] = useState(false);
  const [archiveConsentExpanded, setArchiveConsentExpanded] = useState(false);
  const [backgroundStatus, setBackgroundStatus] = useState<BackgroundStatus>("idle");
  const [backgroundProgress, setBackgroundProgress] = useState(0);
  const [backgroundError, setBackgroundError] = useState<string | null>(null);
  const [pendingUploadAfterBackground, setPendingUploadAfterBackground] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  const [completeSeconds, setCompleteSeconds] = useState(10);
  const [completeTitle, setCompleteTitle] = useState("전송 완료");
  const [error, setError] = useState<string | null>(null);

  const activeRun = useCallback(() => flowRunRef.current, []);
  const onReadyChange = useCallback((ready: boolean) => setCameraReady(ready), []);
  const cameraActive = step === "analysis_capture" || step === "capture";
  const selectedReady = selectedPhotoIndices.length === 4;
  const previewPhotos = beautifiedPhotos.length === capturedPhotos.length ? beautifiedPhotos : capturedPhotos;
  const selectedFramePhotos = useMemo(
    () =>
      Array.from({ length: 4 }, (_, order) => {
        const photoIndex = selectedPhotoIndices[order];
        return typeof photoIndex === "number" ? previewPhotos[photoIndex] : undefined;
      }),
    [previewPhotos, selectedPhotoIndices],
  );
  const beautyPreviewProcessing = beautyPreviewStatus === "processing";
  const screenshotMode =
    process.env.NODE_ENV !== "production" &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("screenshotStep");

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const screenshotStep = params.get("screenshotStep") as Step | null;
    const screenshotCountdown = params.get("screenshotCountdown");
    const screenshotFlash = params.get("screenshotFlash") === "1";
    if (!screenshotStep || !(screenshotStep in STEP_STAGE)) {
      return;
    }

    const demoPhotos = Array.from({ length: FINAL_CAPTURE_COUNT }, (_, index) => demoPhotoDataUrl(index));
    flowRunRef.current += 1;
    captureStartedRef.current = true;
    setSessionId("screenshot-session");
    setCameraReady(true);
    setAnalysis(DEMO_ANALYSIS);
    setTagSelection(DEMO_SELECTION);
    setAnalysisPhoto(demoPhotos[0]);
    setCapturedPhotos(demoPhotos);
    setBeautifiedPhotos(demoPhotos);
    setBeautyPreviewStatus("ready");
    setBeautyPreviewError(null);
    setBeautyStrength(2);
    setSelectedPhotoIndices([0, 1, 2, 3]);
    setRequiredConsentAccepted(screenshotStep !== "consent");
    setArchiveImageConsent(false);
    setBackgroundStatus(screenshotStep === "background_loading" || screenshotStep === "select_photos" ? "generating" : "ready");
    setBackgroundProgress(screenshotStep === "background_loading" ? 72 : screenshotStep === "select_photos" ? 84 : 100);
    setBackgroundError(null);
    setPendingUploadAfterBackground(screenshotStep === "background_loading");
    setUploadStatus("선택한 사진을 네컷 프레임에 맞추고 있습니다");
    setShotIndex(screenshotStep === "capture" ? 2 : 1);
    setShotStatus(screenshotStep === "capture" ? FREE_CAPTURE_READY_TEXT : "화면을 보고 원하는 테마를 몸짓으로 표현해 주세요");
    setFinalUrl(demoFinalDataUrl());
    setCompleteTitle("완료");
    setCameraFlash(screenshotFlash);
    if (screenshotCountdown === "prep") {
      setCountdownMode("prep");
      setCountdownLabel(screenshotStep === "capture" ? "포즈 변경" : "포즈 준비");
      setCountdown(4);
    } else if (screenshotCountdown === "shutter") {
      setCountdownMode("shutter");
      setCountdownLabel("촬영");
      setCountdown(3);
    } else {
      clearCountdown();
    }
    setStep(screenshotStep);
  }, []);

  function requireSession(): string {
    if (!sessionId) {
      throw new Error("세션이 준비되지 않았습니다");
    }
    return sessionId;
  }

  function clearCountdown() {
    setCountdown(null);
    setCountdownLabel(null);
    setCountdownMode(null);
  }

  async function runCountdown(runId: number, values: number[], label: string, mode: CountdownMode): Promise<void> {
    for (const value of values) {
      if (flowRunRef.current !== runId) {
        return;
      }
      setCountdownLabel(label);
      setCountdownMode(mode);
      setCountdown(value);
      await sleep(1000);
    }
    clearCountdown();
  }

  const triggerCameraFlash = useCallback(async (runId: number) => {
    if (flowRunRef.current !== runId) {
      return;
    }
    setCameraFlash(true);
    await sleep(SHUTTER_FLASH_MS);
    if (flowRunRef.current === runId) {
      setCameraFlash(false);
    }
  }, []);

  const captureCurrentFrameWithFlash = useCallback(
    async (runId: number) => {
      if (flowRunRef.current !== runId) {
        return null;
      }
      setShotStatus("찰칵!");
      const flash = triggerCameraFlash(runId);
      await sleep(70);
      const captured = flowRunRef.current === runId ? (cameraRef.current?.capture("image/png") ?? null) : null;
      await flash;
      return captured;
    },
    [triggerCameraFlash],
  );

  async function start() {
    try {
      if (!requiredConsentAccepted) {
        throw new Error("필수 개인정보 수집 및 이용 동의가 필요합니다");
      }
      flowRunRef.current += 1;
      captureStartedRef.current = false;
      setError(null);
      setFinalUrl(null);
      setAnalysisPhoto(null);
      setCapturedPhotos([]);
      setBeautifiedPhotos([]);
      setBeautyPreviewStatus("idle");
      setBeautyPreviewError(null);
      setSelectedPhotoIndices([]);
      setAnalysis(null);
      setTagSelection(null);
      setBackgroundStatus("idle");
      setBackgroundProgress(0);
      setBackgroundError(null);
      setPendingUploadAfterBackground(false);
      setArchiveConsentExpanded(false);
      setUploadStatus("");
      setShotIndex(1);
      setShotStatus("카메라를 준비하고 있습니다");
      setCameraFlash(false);
      setCameraReady(false);
      setCompleteTitle("전송 완료");
      clearCountdown();
      setAnalysisHelpSeconds(10);
      const data = await postJson<{ sessionId: string; expiresAt: string }>("/api/session/start", {
        privacyConsentAccepted: true,
        archiveImageConsent,
      });
      setSessionId(data.sessionId);
      setStep("analysis_help");
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "세션을 시작하지 못했습니다");
    }
  }

  async function restart() {
    const id = sessionId;
    flowRunRef.current += 1;
    captureStartedRef.current = false;
    clearCountdown();
    setCameraFlash(false);
    setStep("idle");
    setSessionId(null);
    setCameraReady(false);
    setAnalysisPhoto(null);
    setCapturedPhotos([]);
    setBeautifiedPhotos([]);
    setBeautyPreviewStatus("idle");
    setBeautyPreviewError(null);
    setSelectedPhotoIndices([]);
    setAnalysis(null);
    setTagSelection(null);
    setRequiredConsentAccepted(false);
    setArchiveImageConsent(false);
    setArchiveConsentExpanded(false);
    setBackgroundStatus("idle");
    setBackgroundProgress(0);
    setBackgroundError(null);
    setPendingUploadAfterBackground(false);
    setUploadStatus("");
    setFinalUrl(null);
    setCompleteSeconds(10);
    setCompleteTitle("전송 완료");
    setAnalysisHelpSeconds(10);
    setError(null);
    if (id) {
      await fetch("/api/session/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: id }),
      }).catch(() => undefined);
    }
  }

  const beginAnalysisCapture = useCallback(() => {
    captureStartedRef.current = false;
    clearCountdown();
    setCameraFlash(false);
    setShotIndex(1);
      setShotStatus("AI가 배경을 고를 사진을 준비해 주세요");
    setCameraReady(false);
    setStep("analysis_capture");
  }, []);

  useEffect(() => {
    if (step !== "analysis_help") {
      return;
    }
    setAnalysisHelpSeconds(10);
    const interval = window.setInterval(() => {
      setAnalysisHelpSeconds((value) => Math.max(value - 1, 0));
    }, 1000);
    const timeout = window.setTimeout(() => {
      beginAnalysisCapture();
    }, 10000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [step, beginAnalysisCapture]);

  const analyzeFirstPhoto = useCallback(
    async (firstPhoto: string, runId: number) => {
      try {
        setStep("analysis_loading");
        const data = await postJson<{ analysis: PoseAnalysis }>("/api/analyze-pose", {
          sessionId: requireSession(),
          imageDataUrl: firstPhoto,
        });
        if (flowRunRef.current !== runId) {
          return;
        }
        setAnalysis(data.analysis);
        setTagSelection(defaultKeywords(data.analysis));
        setStep("tag_select");
      } catch (analysisError) {
        clearCountdown();
        setError(analysisError instanceof Error ? analysisError.message : "AI 추천을 만들지 못했습니다");
      }
    },
    [sessionId],
  );

  const captureAnalysisPhoto = useCallback(async () => {
    const runId = activeRun();
    try {
      setError(null);
      setShotIndex(1);
      setShotStatus("원하는 분위기가 보이도록 크게 포즈를 취해 주세요");
      await runCountdown(runId, PREP_COUNTDOWN_VALUES, "포즈 준비", "prep");
      if (flowRunRef.current !== runId) {
        return;
      }
      setShotStatus("최종 네컷에 들어가지 않는 AI 추천 사진입니다");
      await runCountdown(runId, COUNTDOWN_VALUES, "촬영", "shutter");
      if (flowRunRef.current !== runId) {
        return;
      }
      const captured = await captureCurrentFrameWithFlash(runId);
      if (flowRunRef.current !== runId) {
        return;
      }
      if (!captured) {
        throw new Error("사진을 촬영하지 못했습니다");
      }
      setAnalysisPhoto(captured);
      setShotStatus("AI 추천 사진 저장 완료");
      await analyzeFirstPhoto(captured, runId);
    } catch (captureError) {
      clearCountdown();
      setCameraFlash(false);
      setError(captureError instanceof Error ? captureError.message : "AI가 배경을 고를 사진 촬영에 실패했습니다");
    }
  }, [activeRun, analyzeFirstPhoto, captureCurrentFrameWithFlash]);

  const captureFinalPhotos = useCallback(async () => {
    const runId = activeRun();
    const photos: string[] = [];
    try {
      setError(null);
      setCapturedPhotos([]);
      setBeautifiedPhotos([]);
      setBeautyPreviewStatus("idle");
      setBeautyPreviewError(null);
      setSelectedPhotoIndices([]);
      for (let index = 1; index <= FINAL_CAPTURE_COUNT; index += 1) {
        if (flowRunRef.current !== runId) {
          return;
        }
        setShotIndex(index);
        setShotStatus(FREE_CAPTURE_READY_TEXT);
        await runCountdown(runId, PREP_COUNTDOWN_VALUES, index === 1 ? "포즈 준비" : "포즈 변경", "prep");
        if (flowRunRef.current !== runId) {
          return;
        }
        setShotStatus(FREE_CAPTURE_SHUTTER_TEXT);
        await runCountdown(runId, COUNTDOWN_VALUES, "촬영", "shutter");
        if (flowRunRef.current !== runId) {
          return;
        }
        const captured = await captureCurrentFrameWithFlash(runId);
        if (flowRunRef.current !== runId) {
          return;
        }
        if (!captured) {
          throw new Error("사진을 촬영하지 못했습니다");
        }
        photos.push(captured);
        setCapturedPhotos([...photos]);
        setShotStatus(`${index}번째 사진 저장 완료`);
      }
      if (flowRunRef.current === runId) {
        setStep("select_photos");
      }
    } catch (captureError) {
      clearCountdown();
      setCameraFlash(false);
      setError(captureError instanceof Error ? captureError.message : "최종 사진 촬영에 실패했습니다");
    }
  }, [activeRun, captureCurrentFrameWithFlash]);

  useEffect(() => {
    if ((step !== "analysis_capture" && step !== "capture") || !cameraReady || captureStartedRef.current) {
      return;
    }
    captureStartedRef.current = true;
    if (step === "analysis_capture") {
      void captureAnalysisPhoto();
      return;
    }
    void captureFinalPhotos();
  }, [step, cameraReady, captureAnalysisPhoto, captureFinalPhotos]);

  useEffect(() => {
    if (capturedPhotos.length !== FINAL_CAPTURE_COUNT) {
      beautyRunRef.current += 1;
      setBeautifiedPhotos([]);
      setBeautyPreviewStatus("idle");
      setBeautyPreviewError(null);
      return;
    }

    const runId = beautyRunRef.current + 1;
    beautyRunRef.current = runId;
    setBeautyPreviewStatus("processing");
    setBeautyPreviewError(null);

    Promise.all(capturedPhotos.map((photo) => applyBeautyFilter(photo, beautyStrength)))
      .then((processed) => {
        if (beautyRunRef.current !== runId) {
          return;
        }
        setBeautifiedPhotos(processed);
        setBeautyPreviewStatus("ready");
      })
      .catch(() => {
        if (beautyRunRef.current !== runId) {
          return;
        }
        setBeautifiedPhotos(capturedPhotos);
        setBeautyPreviewStatus("error");
        setBeautyPreviewError("보정 미리보기 적용에 실패했습니다. 원본으로 진행됩니다.");
      });
  }, [capturedPhotos, beautyStrength]);

  const startBackgroundGeneration = useCallback(
    async (selectedKeywords: SelectedKeywords): Promise<boolean> => {
      const runId = activeRun();
      try {
        setBackgroundStatus("generating");
        setBackgroundProgress(8);
        setBackgroundError(null);
        await postJson<{ backgroundUrl: string; usedFallback: boolean }>(
          "/api/generate-background",
          {
            sessionId: requireSession(),
            selectedKeywords,
          },
          190_000,
        );
        if (flowRunRef.current !== runId) {
          return false;
        }
        setBackgroundProgress(100);
        setBackgroundStatus("ready");
        return true;
      } catch (backgroundGenerationError) {
        if (flowRunRef.current !== runId) {
          return false;
        }
        setBackgroundStatus("error");
        setBackgroundError(
          backgroundGenerationError instanceof Error ? backgroundGenerationError.message : "배경 생성에 실패했습니다",
        );
        return false;
      }
    },
    [activeRun, sessionId],
  );

  useEffect(() => {
    if (backgroundStatus !== "generating") {
      return;
    }
    const interval = window.setInterval(() => {
      setBackgroundProgress((value) => Math.min(96, value + Math.max(2, (96 - value) * 0.12)));
    }, 700);
    return () => window.clearInterval(interval);
  }, [backgroundStatus]);

  async function chooseTagsAndContinue() {
    if (!tagSelection) {
      return;
    }
    setSelectedPhotoIndices([]);
    setPendingUploadAfterBackground(false);
    captureStartedRef.current = false;
    setCapturedPhotos([]);
    setBeautifiedPhotos([]);
    setBeautyPreviewStatus("idle");
    setBeautyPreviewError(null);
    setShotIndex(1);
    setShotStatus("최종 촬영을 준비하고 있습니다");
    setCameraReady(false);
    void startBackgroundGeneration(tagSelection);
    setStep("capture");
  }

  function updateSelectedKeyword(category: KeywordCategory, value: string) {
    setTagSelection((current) => (current ? { ...current, [category]: value } : current));
  }

  function retryBackgroundGeneration() {
    if (!tagSelection) {
      return;
    }
    void startBackgroundGeneration(tagSelection);
  }

  function editTagsFromBackground() {
    setPendingUploadAfterBackground(false);
    setStep("tag_select");
  }

  function togglePhoto(index: number) {
    setSelectedPhotoIndices((current) => {
      if (current.includes(index)) {
        return current.filter((item) => item !== index);
      }
      if (current.length >= 4) {
        return current;
      }
      return [...current, index];
    });
  }

  const composeResult = useCallback(async () => {
    setStep("compose");
    const data = await postJson<{ finalUrl: string }>("/api/compose", {
      sessionId: requireSession(),
    });
    setFinalUrl(`${data.finalUrl}?t=${Date.now()}`);
    setStep("result");
  }, [sessionId]);

  async function uploadSelectedPhotos() {
    try {
      if (!selectedReady) {
        throw new Error("최종 사진 4장을 선택해 주세요");
      }
      if (beautyPreviewProcessing) {
        throw new Error("보정 미리보기가 끝난 뒤 다시 눌러 주세요");
      }
      if (backgroundStatus !== "ready") {
        if (backgroundStatus === "error") {
          throw new Error("배경 생성에 실패했습니다. 다시 생성하거나 추천 배경을 다시 골라 주세요.");
        }
        setPendingUploadAfterBackground(true);
        setStep("background_loading");
        return;
      }
      setPendingUploadAfterBackground(false);
      setStep("uploading");
      for (let order = 0; order < selectedPhotoIndices.length; order += 1) {
        const sourceIndex = selectedPhotoIndices[order];
        const raw = previewPhotos[sourceIndex] ?? capturedPhotos[sourceIndex];
        if (!raw) {
          throw new Error("선택한 사진을 찾지 못했습니다");
        }
        setUploadStatus(`${order + 1}/4 크로마키 누끼 처리 중`);
        const segmented = await removeBackgroundDataUrl(raw);
        setUploadStatus(`${order + 1}/4 저장 중`);
        await postJson<{ uploaded: boolean; completedShots: number }>("/api/upload-shot", {
          sessionId: requireSession(),
          index: order + 1,
          imageDataUrl: segmented,
        });
      }
      await composeResult();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "사진 처리에 실패했습니다");
    }
  }

  useEffect(() => {
    if (!pendingUploadAfterBackground || backgroundStatus !== "ready") {
      return;
    }
    void uploadSelectedPhotos();
  }, [pendingUploadAfterBackground, backgroundStatus]);

  async function sendEmail(email: string) {
    try {
      setError(null);
      await postJson<{ sent: boolean; skipped: boolean; messageId?: string }>("/api/send-email", {
        sessionId: requireSession(),
        email,
      });
      setSessionId(null);
      setCompleteSeconds(10);
      setCompleteTitle("전송 완료");
      setStep("complete");
    } catch (emailError) {
      const message = emailError instanceof Error ? emailError.message : "메일 전송에 실패했습니다";
      setError(`${message} 운영요원에게 화면을 보여주세요. 이메일을 수정한 뒤 다시 전송할 수 있습니다.`);
    }
  }

  async function skipEmail() {
    try {
      setError(null);
      await postJson<{ sent: boolean; skipped: boolean; messageId?: string }>("/api/send-email", {
        sessionId: requireSession(),
        skip: true,
      });
      setSessionId(null);
      setCompleteSeconds(10);
      setCompleteTitle("완료");
      setStep("complete");
    } catch (skipError) {
      const message = skipError instanceof Error ? skipError.message : "메일 건너뛰기에 실패했습니다";
      setError(`${message} 운영요원에게 화면을 보여주세요.`);
    }
  }

  useEffect(() => {
    if (step !== "complete") {
      return;
    }
    const interval = window.setInterval(() => {
      setCompleteSeconds((value) => Math.max(value - 1, 0));
    }, 1000);
    const timeout = window.setTimeout(() => {
      void restart();
    }, 10000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [step]);

  const retry = () => {
    const lastStep = step;
    setError(null);
    if ((lastStep === "background_loading" || lastStep === "select_photos") && tagSelection) {
      retryBackgroundGeneration();
      return;
    }
    if (lastStep === "email") {
      setStep("email");
      return;
    }
    void restart();
  };

  return (
    <main className="kiosk-root">
      <div className="photoism-theme kiosk-screen bg-[#050505] text-[#f4f1e8]">
        <KioskHeader step={step} onRestart={() => void restart()} />

        <section className="grid min-h-0 flex-1 px-9 py-7">
          {error && (
            <div className="self-center">
              <ErrorPanel message={error} onRetry={retry} onRestart={() => void restart()} />
            </div>
          )}

          {!error && step === "idle" && (
            <div className="grid h-full grid-cols-[720px_1fr] items-center gap-14">
              <div className="grid place-items-center">
                <FramePreviewMockup />
              </div>

              <div className="grid content-center gap-7">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <p className="text-2xl font-black tracking-[0.2em] text-[var(--primary)]">{CLUB_NAME}</p>
                    <p className="safe-text text-2xl font-black text-[var(--text-muted)]">{CLUB_SLOGAN}</p>
                  </div>
                  <h1 className="safe-text text-[72px] font-black leading-[1.02]">{BOOTH_NAME}</h1>
                  <p className="safe-text max-w-[820px] text-3xl font-black leading-[1.25] text-[var(--text-muted)]">
                    포즈를 취하면 AI가 어울리는 배경을 만들어줘요.
                  </p>
                </div>

                <KioskButton onClick={() => setStep("consent")} className="min-h-[128px] text-5xl">
                  시작하기
                </KioskButton>
                <div className="grid grid-cols-4 gap-3">
                  {["포즈 분석", "AI 배경 추천", "네컷 촬영", "메일 받기"].map((label, index) => (
                    <div key={label} className="rounded-[6px] bg-[var(--surface)] px-4 py-4 text-center">
                      <p className="text-lg font-black text-[var(--primary)]">{index + 1}</p>
                      <p className="mt-1 text-xl font-black text-[var(--text-muted)]">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!error && step === "consent" && (
            <div className="mx-auto grid h-full w-full max-w-[1420px] content-center gap-5">
                <StepTitle
                  eyebrow="00 개인정보 동의"
                  title="촬영 전 확인이 필요합니다"
                  detail="사진 생성과 이메일 발송에 필요한 항목만 확인해 주세요."
                  compact
                />

                <div className="grid grid-cols-3 gap-4">
                  {[
                    ["수집 항목", "촬영 사진, 생성 결과 이미지, 이메일 주소"],
                    ["사용 목적", "AI 네컷사진 생성 및 이메일 발송"],
                    ["보관 기간", "발송 후 즉시 삭제, 오류 대응 시 최대 24시간"],
                  ].map(([label, value]) => (
                    <div key={label} className="grid gap-3 rounded-[6px] bg-[var(--surface)] px-6 py-5">
                      <p className="text-xl font-black text-[var(--primary)]">{label}</p>
                      <p className="safe-text text-3xl font-black leading-tight text-[var(--text)]">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-[6px] bg-[var(--surface)] p-4">
                  {[
                    ["외부 서비스", "OpenAI API, Brevo 이메일 API"],
                    ["동의 거부 시", "이메일 발송형 촬영 서비스 이용 불가"],
                  ].map(([label, value]) => (
                    <div key={label} className="grid gap-1 rounded-[4px] border border-[var(--line-soft)] px-4 py-3">
                      <p className="text-lg font-black text-[var(--text-subtle)]">{label}</p>
                      <p className="safe-text text-xl font-black leading-tight text-[var(--text-muted)]">{value}</p>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setRequiredConsentAccepted((value) => !value)}
                  className={`grid gap-3 rounded-[6px] border-2 p-5 text-left active:translate-y-[2px] ${
                    requiredConsentAccepted
                      ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-text)]"
                      : "border-[var(--line)] bg-[var(--surface)] text-[var(--text)]"
                  }`}
                >
                  <div className="flex items-start gap-5">
                    <span
                      className={`mt-1 grid h-16 w-16 shrink-0 place-items-center rounded-[6px] border-2 ${
                        requiredConsentAccepted ? "border-[#050505] bg-[#050505] text-[var(--primary)]" : "border-[var(--line)] bg-transparent"
                      }`}
                    >
                      {requiredConsentAccepted && <Check className="h-9 w-9" />}
                    </span>
                    <div className="grid gap-2">
                      <p className="text-2xl font-black tracking-[0.16em] opacity-70">필수</p>
                      <h3 className="safe-text text-3xl font-black leading-tight">개인정보 수집 및 이용에 동의합니다.</h3>
                    </div>
                  </div>
                  <p className={`safe-text text-xl font-bold leading-7 ${requiredConsentAccepted ? "text-[#050505]/68" : "text-[#f4f1e8]/58"}`}>
                    사진 생성과 이메일 발송을 위해 촬영 사진, 생성 이미지, 이메일 주소를 사용합니다.
                  </p>
                </button>

                <div className="grid gap-3 rounded-[6px] border border-[var(--line-soft)] bg-[var(--surface)] p-4">
                  <div className="grid grid-cols-[1fr_180px] items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setArchiveImageConsent((value) => !value)}
                      className="flex min-h-[76px] items-center gap-4 rounded-[6px] text-left active:translate-y-[2px]"
                    >
                      <span
                        className={`grid h-14 w-14 shrink-0 place-items-center rounded-[6px] border-2 ${
                          archiveImageConsent ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-text)]" : "border-[var(--line)] bg-transparent text-transparent"
                        }`}
                      >
                        <Check className="h-8 w-8" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-lg font-black tracking-[0.16em] text-[var(--text-subtle)]">선택 동의</p>
                        <h3 className="safe-text truncate text-2xl font-black text-[var(--text)]">
                          행사 홍보 및 결과 전시를 위한 완성 사진 저장
                        </h3>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setArchiveConsentExpanded((value) => !value)}
                      className="min-h-[64px] rounded-[6px] border border-[var(--line-soft)] bg-[#050505]/24 px-4 text-xl font-black text-[var(--text-muted)] active:translate-y-[2px]"
                    >
                      {archiveConsentExpanded ? "접기" : "자세히"}
                    </button>
                  </div>
                  {archiveConsentExpanded && (
                    <p className="safe-text rounded-[4px] bg-[#050505]/30 px-5 py-4 text-xl font-bold leading-7 text-[var(--text-muted)]">
                      완성 사진을 행사 홍보와 결과 전시 용도로 보관하는 선택 항목입니다. 선택하지 않아도 촬영과 이메일 발송은 가능합니다.
                    </p>
                  )}
                </div>

              <div className="grid grid-cols-[1fr_360px] gap-5">
                <KioskButton onClick={() => void start()} disabled={!requiredConsentAccepted} className="min-h-[100px] text-5xl">
                  동의하고 시작하기
                </KioskButton>
                <KioskButton onClick={() => setStep("idle")} tone="secondary">
                  처음 화면
                </KioskButton>
              </div>
            </div>
          )}

          {!error && step === "analysis_help" && (
            <div className="grid h-full place-items-center text-[var(--text)]">
              <div className="grid w-full max-w-[1180px] gap-8 rounded-[8px] bg-[var(--surface)] p-10 text-center">
                <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-2 border-[var(--primary)] text-[var(--primary)]">
                  <Sparkles className="h-16 w-16" />
                </div>
                <div className="grid gap-4">
                  <p className="text-2xl font-black tracking-[0.22em] text-[var(--primary)]">01 AI 추천 준비</p>
                  <h2 className="safe-text text-6xl font-black leading-tight">AI가 배경을 고를 사진을 찍습니다</h2>
                  <p className="safe-text mx-auto max-w-[940px] text-3xl font-black leading-snug text-[var(--text-muted)]">
                    이 사진은 최종 네컷에 들어가지 않습니다. 원하는 분위기가 잘 나오도록 포즈나 소품을 크게 보여 주세요.
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {POSE_EXAMPLES.map((label) => (
                    <div key={label} className="rounded-[6px] bg-[var(--surface-2)] px-5 py-5 text-2xl font-black">
                      {label}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-[1fr_220px] gap-5">
                  <KioskButton onClick={beginAnalysisCapture} className="min-h-[118px] text-5xl">
                    확인
                  </KioskButton>
                  <div className="grid place-items-center rounded-[6px] border border-[var(--line)] px-4 text-3xl font-black text-[var(--text-muted)]">
                    {analysisHelpSeconds}초
                  </div>
                </div>
              </div>
            </div>
          )}

          {!error && (step === "analysis_capture" || step === "capture") && (
            <div className="grid min-h-0 grid-cols-[1fr_620px] gap-9">
              <div className="grid min-h-0 place-items-center">
                <div className="relative h-full max-h-[820px] w-full max-w-[615px]">
                  {screenshotMode ? (
                    <div className="relative h-full overflow-hidden rounded-[6px] border-[3px] border-[var(--line-strong)] bg-[#050505] p-8">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={step === "analysis_capture" ? (analysisPhoto ?? demoPhotoDataUrl(0)) : demoPhotoDataUrl(Math.max(shotIndex - 1, 0))}
                        alt="촬영 미리보기"
                        className="h-full w-full rounded-[4px] object-cover"
                      />
                      <CameraGuideOverlay />
                      <Countdown value={countdownMode === "shutter" ? countdown : null} label={countdownLabel} variant="shutter" />
                      {cameraFlash && <div className="camera-flash-effect" aria-hidden="true" />}
                    </div>
                  ) : (
                    <CameraPreview
                      ref={cameraRef}
                      active={cameraActive}
                      onReadyChange={onReadyChange}
                      variant="kiosk"
                    >
                      <Countdown value={countdownMode === "shutter" ? countdown : null} label={countdownLabel} variant="shutter" />
                      {cameraFlash && <div className="camera-flash-effect" aria-hidden="true" />}
                    </CameraPreview>
                  )}
                  <div className="absolute bottom-6 left-6 right-6 rounded-[6px] border border-[var(--line)] bg-[#050505]/86 px-7 py-4 text-center text-3xl font-black text-[var(--text)]">
                    {step === "analysis_capture" ? "AI가 배경을 고를 사진" : `${shotIndex}/${FINAL_CAPTURE_COUNT} 컷`}
                  </div>
                </div>
              </div>
              <div className="grid content-center gap-8">
                <StepTitle
                  eyebrow={step === "analysis_capture" ? "01 AI 추천 사진" : "03 자동 촬영"}
                  title={step === "analysis_capture" ? "크게 포즈를 보여 주세요" : `${shotIndex}/${FINAL_CAPTURE_COUNT} 컷`}
                  detail={step === "analysis_capture" ? "최종 네컷에는 들어가지 않는 AI 추천 사진입니다." : "자동 촬영"}
                  compact
                  right={<div className="rounded-[6px] bg-[var(--primary)] px-6 py-4 text-2xl font-black text-[var(--primary-text)]">AUTO</div>}
                />
                <Countdown value={countdownMode === "prep" ? countdown : null} label={countdownLabel} variant="prep" />
                {step === "capture" && <CaptureRail captured={capturedPhotos} activeIndex={shotIndex} count={FINAL_CAPTURE_COUNT} />}
                {step === "capture" && backgroundStatus !== "idle" && (
                  <BackgroundProgress status={backgroundStatus} progress={backgroundProgress} error={backgroundError} compact />
                )}
                <div className="rounded-[6px] bg-[var(--surface)] p-7">
                  <p className="safe-text text-4xl font-black leading-tight text-[var(--text)]">{shotStatus}</p>
                  <p className="mt-3 safe-text text-2xl font-black text-[var(--text-muted)]">
                    {step === "analysis_capture" ? "화면을 보고 원하는 테마를 몸짓으로 표현해 주세요." : "5초 준비 후 자동으로 촬영합니다."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!error && step === "analysis_loading" && (
            <LoadingPanel
              icon={<Tags className="h-16 w-16 animate-pulse" />}
              title="AI가 배경을 추천하고 있습니다"
              detail="포즈에 어울리는 장소, 느낌, 색, 장식을 고르는 중입니다"
            />
          )}

          {!error && step === "tag_select" && analysis && tagSelection && (
            <div className="grid min-h-0 grid-cols-[390px_1fr] gap-8">
              <div className="grid min-h-0 content-center gap-4">
                <div className="overflow-hidden rounded-[6px] border border-[var(--line)] bg-[var(--surface)] p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={analysisPhoto ?? capturedPhotos[0]} alt="AI 추천 기준 사진" className="aspect-[3/4] w-full object-cover" />
                </div>
                <div className="rounded-[6px] bg-[var(--surface)] p-5 text-center">
                  <p className="text-xl font-black text-[var(--primary)]">AI가 포즈를 분석했어요</p>
                  <p className="mt-2 safe-text text-2xl font-black text-[var(--text-muted)]">
                    메인 테마를 고르고 세부 태그를 조합해 주세요.
                  </p>
                </div>
              </div>

              <div className="grid content-center gap-5">
                <StepTitle
                  eyebrow="02 AI 추천"
                  title="배경 조합을 만들어 주세요"
                  detail="큰 테마 하나를 고르고, 아래 세부 태그로 원하는 분위기를 더합니다."
                  compact
                />

                <div className="grid gap-4">
                  <div className="grid gap-3 rounded-[8px] bg-[var(--surface)] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-lg font-black tracking-[0.16em] text-[var(--primary)]">MAIN THEME</p>
                        <h3 className="mt-1 text-3xl font-black text-[var(--text)]">전반적인 배경 테마</h3>
                      </div>
                      <p className="safe-text max-w-[380px] text-right text-lg font-black text-[var(--text-muted)]">
                        먼저 큰 세계관을 고르면 AI가 이 테마를 중심으로 배경을 만듭니다.
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {analysis.recommended_keywords.theme.map((keyword) => {
                        const active = tagSelection.theme === keyword;
                        return (
                          <button
                            key={keyword}
                            type="button"
                            onClick={() => updateSelectedKeyword("theme", keyword)}
                            className={`min-h-[72px] rounded-[6px] border-2 px-4 text-2xl font-black active:translate-y-[2px] ${
                              active
                                ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-text)]"
                                : "border-[var(--line-soft)] bg-[#050505] text-[var(--text)]"
                            }`}
                          >
                            {keyword}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {DETAIL_CATEGORIES.map((category) => {
                      const selected = tagSelection[category];
                      const options = analysis.recommended_keywords[category];
                      return (
                        <div key={category} className="grid content-start gap-3 rounded-[8px] bg-[var(--surface)] p-4">
                          <div>
                            <p className="text-base font-black tracking-[0.16em] text-[var(--text-subtle)]">
                              DETAIL TAG
                            </p>
                            <h3 className="mt-1 text-2xl font-black text-[var(--text)]">{CATEGORY_LABELS[category]}</h3>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {options.map((keyword) => {
                              const active = selected === keyword;
                              return (
                                <button
                                  key={`${category}-${keyword}`}
                                  type="button"
                                  onClick={() => updateSelectedKeyword(category, keyword)}
                                  className={`min-h-[58px] rounded-[6px] border px-3 text-left text-xl font-black active:translate-y-[2px] ${
                                    active
                                      ? "border-[var(--primary)] bg-[rgba(94,234,212,0.12)] text-[var(--primary)]"
                                      : "border-[var(--line-soft)] bg-[#050505] text-[var(--text-muted)]"
                                  }`}
                                >
                                  {keyword}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-[1fr_auto] items-center gap-5 rounded-[8px] border border-[var(--line-soft)] bg-[var(--surface)] px-6 py-3">
                    <div className="min-w-0">
                      <p className="text-lg font-black text-[var(--primary)]">현재 조합</p>
                      <h3 className="safe-text mt-1 text-2xl font-black text-[var(--text)]">{conceptTitle(tagSelection)}</h3>
                      <p className="safe-text mt-1 text-lg font-black text-[var(--text-muted)]">{conceptStory(tagSelection)}</p>
                    </div>
                    <div className="flex max-w-[460px] flex-wrap justify-end gap-2">
                      {CATEGORIES.map((category) => (
                        <span key={category} className="rounded-full bg-[#f4f1e8]/8 px-4 py-1.5 text-base font-black text-[var(--text-muted)]">
                          {CATEGORY_LABELS[category]}: {tagSelection[category]}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <KioskButton onClick={() => void chooseTagsAndContinue()} className="min-h-[82px] text-2xl">
                  이 조합으로 촬영하기
                  <ArrowRight className="h-11 w-11" />
                </KioskButton>
              </div>
            </div>
          )}

          {!error && step === "background_loading" && (
            <div className="grid h-full grid-cols-[1fr_620px] items-center gap-10">
              <div className="grid gap-7 text-[var(--text)]">
                <StepTitle
                  eyebrow="AI 합성"
                  title={pendingUploadAfterBackground ? "AI가 배경을 만드는 중" : "선택한 분위기로 배경을 만들고 있어요"}
                  detail={
                    pendingUploadAfterBackground
                      ? "배경이 준비되면 선택한 사진 4장을 자동으로 합성합니다."
                      : "빛과 장식을 배치하는 동안 잠시만 기다려 주세요."
                  }
                  compact
                />
                {tagSelection && (
                  <div className="grid gap-4 rounded-[8px] bg-[var(--surface)] p-6">
                    <p className="text-2xl font-black text-[var(--primary)]">오늘의 콘셉트: {conceptTitle(tagSelection)}</p>
                    <p className="safe-text text-3xl font-black leading-tight text-[var(--text)]">{conceptStory(tagSelection)}</p>
                  <div className="flex flex-wrap gap-3">
                    {CATEGORIES.map((category) => (
                      <span key={category} className="rounded-full bg-[#f4f1e8]/8 px-5 py-3 text-xl font-black text-[var(--text-muted)]">
                        {CATEGORY_LABELS[category]}: {tagSelection[category]}
                      </span>
                    ))}
                  </div>
                  </div>
                )}
                {selectedPhotoIndices.length > 0 && (
                  <CompositingFramePreview photos={selectedFramePhotos} title="선택한 사진에 AI 배경을 입히는 중" compact />
                )}
              </div>
              <div className="grid gap-5">
                <BackgroundProgress status={backgroundStatus} progress={backgroundProgress} error={backgroundError} />
                {backgroundStatus === "error" && (
                  <div className="grid grid-cols-2 gap-4">
                    <KioskButton onClick={retryBackgroundGeneration} className="text-3xl">
                      다시 생성
                    </KioskButton>
                    <KioskButton onClick={editTagsFromBackground} tone="secondary" className="text-3xl">
                      배경 수정
                    </KioskButton>
                  </div>
                )}
              </div>
            </div>
          )}

          {!error && step === "select_photos" && (
            <div className="grid min-h-0 grid-cols-[1fr_560px] gap-8">
              <div className="grid min-h-0 grid-rows-[auto_1fr] gap-6">
                <StepTitle
                  eyebrow="03 사진 선택"
                  title={`최종 사진 ${selectedPhotoIndices.length}/4`}
                  detail="마음에 드는 사진 4장을 골라 주세요. 고른 순서대로 네컷에 들어갑니다."
                  compact
                />
                <div className="grid min-h-0 max-w-[900px] grid-cols-3 gap-4">
                  {previewPhotos.map((photo, index) => {
                    const selectedOrder = selectedPhotoIndices.indexOf(index);
                    const selected = selectedOrder !== -1;
                    return (
                      <button
                        key={photo}
                        type="button"
                        onClick={() => togglePhoto(index)}
                        className={`relative overflow-hidden rounded-[6px] border-2 bg-[var(--surface)] active:translate-y-[2px] ${
                          selected ? "border-[var(--primary)]" : "border-[var(--line-soft)]"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo} alt={`${index + 1}번 사진`} className="aspect-[3/4] w-full object-cover" />
                        <span className="absolute left-3 top-3 rounded-[3px] bg-[#050505]/80 px-3 py-1 text-xl font-black text-[var(--text)]">
                          {index + 1}
                        </span>
                        {selected && (
                          <span className="absolute right-3 top-3 grid h-12 w-12 place-items-center rounded-full bg-[var(--primary)] text-2xl font-black text-[var(--primary-text)]">
                            {selectedOrder + 1}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid content-center gap-5">
                <BackgroundProgress status={backgroundStatus} progress={backgroundProgress} error={backgroundError} compact />
                <div className="grid gap-3 rounded-[6px] bg-[var(--surface)] p-4">
                  <p className="text-xl font-black text-[var(--text-subtle)]">선택된 4장</p>
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 4 }, (_, order) => {
                      const photoIndex = selectedPhotoIndices[order];
                      const src = typeof photoIndex === "number" ? previewPhotos[photoIndex] : undefined;
                      return (
                        <div key={order} className="relative aspect-[3/4] overflow-hidden rounded-[4px] bg-[#050505]">
                          {src ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={src} alt={`${order + 1}번째 선택 사진`} className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full place-items-center text-xl font-black text-[var(--text-subtle)]">{order + 1}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <BeautySelector value={beautyStrength} onChange={setBeautyStrength} />
                {beautyPreviewStatus === "processing" && (
                  <p className="rounded-[4px] border-2 border-[#f4f1e8]/55 px-5 py-3 text-center text-2xl font-black text-[#f4f1e8]/72">
                    보정 미리보기 적용 중
                  </p>
                )}
                {beautyPreviewError && (
                  <p className="safe-text rounded-[4px] border-2 border-[#f04438]/70 px-5 py-3 text-center text-xl font-black text-[#f04438]">
                    {beautyPreviewError}
                  </p>
                )}
                {backgroundStatus === "error" ? (
                  <div className="grid grid-cols-2 gap-4">
                    <KioskButton onClick={retryBackgroundGeneration} className="text-3xl">
                      배경 다시 생성
                    </KioskButton>
                    <KioskButton onClick={editTagsFromBackground} tone="secondary" className="text-3xl">
                      배경 수정
                    </KioskButton>
                  </div>
                ) : (
                  <KioskButton
                    onClick={() => void uploadSelectedPhotos()}
                    disabled={!selectedReady || beautyPreviewProcessing}
                    className="min-h-[108px] text-4xl"
                  >
                    {beautyPreviewProcessing
                      ? "보정 적용 중"
                      : backgroundStatus === "ready"
                        ? "선택한 4장으로 만들기"
                        : "배경 준비되면 만들기"}
                  </KioskButton>
                )}
              </div>
            </div>
          )}

          {!error && step === "uploading" && (
            <div className="grid h-full grid-cols-[560px_1fr] items-center gap-12">
              <CompositingFramePreview photos={selectedFramePhotos} title="크로마키 사진을 프레임에 올리는 중" />
              <LoadingPanel
                icon={<Wand2 className="h-16 w-16 animate-pulse" />}
                title="사진을 정리하고 있습니다"
                detail={uploadStatus || "선택한 사진을 보정하고 저장합니다"}
              />
            </div>
          )}

          {!error && step === "compose" && (
            <div className="grid h-full grid-cols-[560px_1fr] items-center gap-12">
              <CompositingFramePreview photos={selectedFramePhotos} title="AI 배경과 네컷 프레임을 합성하는 중" />
              <LoadingPanel
                icon={<Camera className="h-16 w-16 animate-pulse" />}
                title="네컷 사진을 만들고 있습니다"
                detail="선택한 4장과 배경을 최종 프레임에 맞춰 합성합니다"
              />
            </div>
          )}

          {!error && step === "result" && finalUrl && (
            <div className="grid min-h-0 grid-cols-[620px_1fr] gap-10">
              <div className="grid min-h-0 place-items-center">
                <div className="h-full max-h-[900px] rounded-[6px] border-2 border-[var(--line-strong)] bg-[#050505] p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={finalUrl} alt="완성된 네컷" className="h-full w-full object-contain" />
                </div>
              </div>
              <div className="grid content-center gap-8">
                <StepTitle
                  eyebrow="04 완성"
                  title="사진이 완성되었습니다"
                  detail="메일 주소를 입력하면 완성본을 받을 수 있습니다"
                  compact
                />
                <div className="grid gap-3 rounded-[8px] bg-[var(--surface)] p-7">
                  <p className="text-2xl font-black text-[var(--primary)]">오늘의 콘셉트</p>
                  <h3 className="safe-text text-5xl font-black leading-tight">{conceptTitle(tagSelection)}</h3>
                  <p className="safe-text text-2xl font-black text-[var(--text-muted)]">
                    {conceptStory(tagSelection)} AI가 과학축제 네컷 분위기로 완성했습니다.
                  </p>
                  {analysis?.ui_caption && (
                    <p className="safe-text rounded-[6px] bg-[#050505]/50 px-5 py-4 text-xl font-black text-[var(--text-muted)]">
                      AI 한줄평 · {analysis.ui_caption}
                    </p>
                  )}
                </div>
                <div className="grid gap-5">
                  <KioskButton onClick={() => setStep("email")} className="min-h-[128px] text-5xl">
                    <Mail className="h-14 w-14" />
                    메일로 받기
                  </KioskButton>
                  <KioskButton onClick={() => void restart()} tone="secondary">
                    <RotateCcw className="h-12 w-12" />
                    처음으로
                  </KioskButton>
                </div>
              </div>
            </div>
          )}

          {!error && step === "email" && (
            <div className="grid min-h-0 grid-cols-[420px_1fr] gap-8">
              <div className="grid content-center gap-8">
                <StepTitle
                  eyebrow="04 메일 입력"
                  title="메일로 받기"
                  detail="아이디를 입력하고 도메인을 고르면 전송 전 주소를 한 번 더 확인합니다."
                  compact
                />
                <div className="rounded-[6px] bg-[var(--surface)] p-6 text-2xl font-black leading-snug text-[var(--text-muted)]">
                  메일을 받지 않아도 건너뛰기로 촬영을 마칠 수 있습니다.
                </div>
              </div>
              <EmailForm onSubmit={sendEmail} onSkip={skipEmail} layout="landscape" />
            </div>
          )}

          {!error && step === "complete" && (
            <div className="grid place-items-center text-center text-[#f4f1e8]">
              <div className="grid gap-8">
                <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border-[4px] border-[#f4f1e8] bg-transparent">
                  <Check className="h-20 w-20" />
                </div>
                <div className="grid gap-4">
                  <h2 className="text-7xl font-black">{completeTitle}</h2>
                  <p className="text-3xl font-bold text-[#f4f1e8]/65">
                    {completeSeconds}초 뒤 처음 화면으로 돌아갑니다
                  </p>
                </div>
                <KioskButton onClick={() => void restart()} tone="secondary">
                  <Home className="h-12 w-12" />
                  처음 화면
                </KioskButton>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

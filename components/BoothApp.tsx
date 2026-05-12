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
import { CameraPreview, type CameraPreviewHandle } from "./CameraPreview";
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

const CATEGORIES: KeywordCategory[] = ["theme", "mood", "color", "effect"];
const CATEGORY_LABELS: Record<KeywordCategory, string> = {
  theme: "테마",
  mood: "분위기",
  color: "색감",
  effect: "효과",
};
const EVENT_TITLE = "2026. 진주시와 함께하는 경남과학고등학교 수학, 과학, 정보 페스티벌";
const STAGE_LABELS = ["시작", "촬영", "태그", "선택", "완성"];
const BACKGROUND_STAGES = [
  "선택한 태그 정리",
  "배경 콘셉트 구성",
  "이미지 생성 요청",
  "사진 합성 준비",
];
const FINAL_CAPTURE_COUNT = 6;
const PREP_COUNTDOWN_VALUES = [5, 4, 3, 2, 1];
const COUNTDOWN_VALUES = [3, 2, 1];

const STEP_STAGE: Record<Step, number> = {
  idle: 0,
  consent: 0,
  analysis_help: 1,
  analysis_capture: 1,
  capture: 3,
  analysis_loading: 2,
  tag_select: 2,
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
    primary: "border-[#f4f1e8] bg-[#f4f1e8] text-[#050505]",
    secondary: "border-[#f4f1e8] bg-transparent text-[#f4f1e8]",
    danger: "border-[#f04438] bg-[#f04438] text-white",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-[96px] items-center justify-center gap-4 rounded-[4px] border-[3px] px-8 text-4xl font-black active:translate-y-[2px] disabled:cursor-not-allowed disabled:opacity-35 ${classes[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

function KioskHeader({ step, onRestart }: { step: Step; onRestart: () => void }) {
  const activeStage = STEP_STAGE[step];

  return (
    <header className="grid h-[96px] shrink-0 grid-cols-[1fr_auto] items-center border-b-[3px] border-[#f4f1e8] bg-[#050505] px-9 text-[#f4f1e8]">
      <div className="flex min-w-0 items-center gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/ieum-logo.png" alt="IEUM" className="h-12 w-24 object-contain" />
        <div className="min-w-0">
          <p className="safe-text truncate text-xl font-black">{EVENT_TITLE}</p>
          <p className="text-sm font-black tracking-[0.24em] text-[#f4f1e8]/55">FESTIVAL PHOTO</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex gap-2">
          {STAGE_LABELS.map((label, index) => (
            <div
              key={label}
              className={`flex h-11 min-w-[88px] items-center justify-center rounded-[4px] border-2 px-3 text-sm font-black ${
                index <= activeStage
                  ? "border-[#f4f1e8] bg-[#f4f1e8] text-[#050505]"
                  : "border-[#f4f1e8]/55 bg-transparent text-[#f4f1e8]/55"
              }`}
            >
              {label}
            </div>
          ))}
        </div>
        {step !== "idle" && step !== "complete" && (
          <button
            type="button"
            onClick={onRestart}
            className="flex h-16 w-16 items-center justify-center rounded-[4px] border-[3px] border-[#f4f1e8] bg-transparent text-[#f4f1e8] active:translate-y-[2px]"
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
    <div className="flex items-end justify-between gap-8 border-b-[3px] border-[#f4f1e8] pb-5 text-[#f4f1e8]">
      <div className="grid gap-1">
        <p className="text-xl font-black tracking-[0.18em] text-[#f4f1e8]/58">{eyebrow}</p>
        <h2 className={`safe-text font-black leading-[1.05] ${compact ? "text-5xl" : "text-6xl"}`}>{title}</h2>
        {detail && <p className="safe-text max-w-[980px] text-2xl font-bold text-[#f4f1e8]/64">{detail}</p>}
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
    <div className="grid w-[600px] gap-5 rounded-[4px] border-[3px] border-[#f4f1e8] bg-[#050505] p-7">
      <div className="grid grid-cols-2 gap-5">
        {[1, 2, 3, 4].map((index) => (
          <div
            key={index}
            className="grid aspect-[3/4] place-items-center border-[3px] border-[#f4f1e8] bg-[#f4f1e8] text-[#050505]"
          >
            <span className="text-3xl font-black">{index}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[84px_1fr_110px] items-center gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/school-mark.png" alt="경남과학고등학교" className="h-20 w-20 rounded-full bg-[#f4f1e8] object-cover" />
        <div className="text-center">
          <p className="text-lg font-black leading-tight text-[#f4f1e8]">경남과학고등학교</p>
          <p className="mt-1 text-sm font-black tracking-[0.18em] text-[#f4f1e8]/62">FESTIVAL FRAME</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/keuni-deuri-hands.png" alt="크니 드리" className="h-20 w-[110px] object-contain" />
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
    <div className="grid gap-4 rounded-[4px] border-[3px] border-[#f4f1e8]/78 bg-[#0b0b0b] p-5 text-[#f4f1e8]">
      <div className="flex items-end justify-between gap-4">
        <div className="grid gap-1">
          <p className="text-lg font-black tracking-[0.18em] text-[#f4f1e8]/58">촬영 설정</p>
          <h3 className="text-3xl font-black">얼굴 보정</h3>
        </div>
        <span className="rounded-[4px] bg-[#f4f1e8] px-4 py-2 text-xl font-black text-[#050505]">
          {BEAUTY_OPTIONS.find((option) => option.value === value)?.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {BEAUTY_OPTIONS.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`grid min-h-[86px] content-center gap-1 rounded-[4px] border-[3px] px-3 text-center active:translate-y-[2px] ${
                active
                  ? "border-[#f4f1e8] bg-[#f4f1e8] text-[#050505]"
                  : "border-[#f4f1e8]/70 bg-transparent text-[#f4f1e8]"
              }`}
            >
              <span className="text-2xl font-black">{option.label}</span>
              <span className={`text-base font-black ${active ? "text-[#050505]/70" : "text-[#f4f1e8]/58"}`}>
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
}: {
  status: BackgroundStatus;
  progress: number;
  error: string | null;
}) {
  const activeStage = Math.min(BACKGROUND_STAGES.length - 1, Math.floor((progress / 100) * BACKGROUND_STAGES.length));

  return (
    <div className="grid gap-4 rounded-[4px] border-[3px] border-[#f4f1e8]/78 bg-[#0b0b0b] p-5 text-[#f4f1e8]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-lg font-black tracking-[0.18em] text-[#f4f1e8]/58">배경 생성</p>
          <h3 className="text-3xl font-black">
            {status === "ready" ? "배경 준비 완료" : status === "error" ? "배경 생성 실패" : "배경을 만들고 있습니다"}
          </h3>
        </div>
        <div className="text-3xl font-black">{status === "ready" ? "100%" : `${Math.round(progress)}%`}</div>
      </div>

      <div className="ai-progress-track h-4 overflow-hidden rounded-full bg-[#f4f1e8]/18">
        <div className="ai-progress-fill h-full rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>

      {error ? (
        <p className="safe-text text-xl font-black text-[#f04438]">{error}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {BACKGROUND_STAGES.map((label, index) => (
            <div
              key={label}
              className={`ai-generation-step rounded-[4px] border-2 px-4 py-3 text-lg font-black ${
                index <= activeStage
                  ? "is-active border-[#f4f1e8] text-[#f4f1e8]"
                  : "border-[#f4f1e8]/26 text-[#f4f1e8]/42"
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
  const beautyPreviewProcessing = beautyPreviewStatus === "processing";

  function requireSession(): string {
    if (!sessionId) {
      throw new Error("세션이 준비되지 않았습니다");
    }
    return sessionId;
  }

  async function runCountdown(runId: number, values: number[], label: string): Promise<void> {
    for (const value of values) {
      if (flowRunRef.current !== runId) {
        return;
      }
      setCountdownLabel(label);
      setCountdown(value);
      await sleep(1000);
    }
    setCountdown(null);
    setCountdownLabel(null);
  }

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
      setUploadStatus("");
      setShotIndex(1);
      setShotStatus("카메라를 준비하고 있습니다");
      setCameraReady(false);
      setCompleteTitle("전송 완료");
      setCountdown(null);
      setCountdownLabel(null);
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
    setCountdown(null);
    setCountdownLabel(null);
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
    setCountdown(null);
    setCountdownLabel(null);
    setShotIndex(1);
    setShotStatus("AI가 포즈를 분석할 사진을 준비해 주세요");
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
        setCountdown(null);
        setCountdownLabel(null);
        setError(analysisError instanceof Error ? analysisError.message : "태그 분석에 실패했습니다");
      }
    },
    [sessionId],
  );

  const captureAnalysisPhoto = useCallback(async () => {
    const runId = activeRun();
    try {
      setError(null);
      setShotIndex(1);
      setShotStatus("분석용 사진을 위한 포즈를 준비해 주세요");
      await runCountdown(runId, PREP_COUNTDOWN_VALUES, "준비 시간");
      if (flowRunRef.current !== runId) {
        return;
      }
      setShotStatus("분석용 사진을 촬영합니다");
      await runCountdown(runId, COUNTDOWN_VALUES, "촬영");
      if (flowRunRef.current !== runId) {
        return;
      }
      const captured = cameraRef.current?.capture("image/png");
      if (!captured) {
        throw new Error("사진을 촬영하지 못했습니다");
      }
      setAnalysisPhoto(captured);
      setShotStatus("분석용 사진 저장 완료");
      await analyzeFirstPhoto(captured, runId);
    } catch (captureError) {
      setCountdown(null);
      setCountdownLabel(null);
      setError(captureError instanceof Error ? captureError.message : "분석용 사진 촬영에 실패했습니다");
    }
  }, [activeRun, analyzeFirstPhoto]);

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
        setShotStatus(`${index}번째 사진을 위한 포즈를 준비해 주세요`);
        await runCountdown(runId, PREP_COUNTDOWN_VALUES, index === 1 ? "준비 시간" : "포즈 변경");
        if (flowRunRef.current !== runId) {
          return;
        }
        setShotStatus(`${index}번째 사진을 촬영합니다`);
        await runCountdown(runId, COUNTDOWN_VALUES, "촬영");
        if (flowRunRef.current !== runId) {
          return;
        }
        const captured = cameraRef.current?.capture("image/png");
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
      setCountdown(null);
      setCountdownLabel(null);
      setError(captureError instanceof Error ? captureError.message : "최종 사진 촬영에 실패했습니다");
    }
  }, [activeRun]);

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
          throw new Error("배경 생성에 실패했습니다. 다시 생성하거나 태그를 수정해 주세요.");
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
      <Countdown value={countdown} label={countdownLabel} />
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
                  <p className="text-2xl font-black tracking-[0.26em] text-[#f4f1e8]/58">FESTIVAL PHOTO</p>
                  <h1 className="safe-text text-[74px] font-black leading-[0.98]">네컷 촬영</h1>
                  <p className="safe-text max-w-[820px] text-3xl font-black leading-[1.25]">{EVENT_TITLE}</p>
                </div>

                <div className="grid grid-cols-5 gap-3 text-center">
                  {["분석 1장", "태그 선택", "6장 촬영", "4장 선택", "메일 전송"].map((label) => (
                    <div key={label} className="rounded-[4px] border-[2px] border-[#f4f1e8]/55 px-4 py-5 text-xl font-black">
                      {label}
                    </div>
                  ))}
                </div>

                <KioskButton onClick={() => setStep("consent")} className="min-h-[128px] text-5xl">
                  시작하기
                </KioskButton>
                <p className="safe-text text-center text-xl font-bold text-[#f4f1e8]/58">
                  다음 화면에서 개인정보 수집 및 이용 내용을 확인한 뒤 촬영을 시작합니다.
                </p>
              </div>
            </div>
          )}

          {!error && step === "consent" && (
            <div className="mx-auto grid h-full w-full max-w-[1420px] content-center gap-5">
                <StepTitle
                  eyebrow="00 개인정보 동의"
                  title="촬영 전 동의가 필요합니다"
                  detail="외부 손님 대상 행사 운영을 위해 수집 항목, 보관 기간, 외부 서비스를 확인해 주세요."
                  compact
                />

                <div className="grid grid-cols-2 gap-3 rounded-[4px] border-[3px] border-[#f4f1e8] bg-[#0b0b0b] p-5">
                  {[
                    ["수집 항목", "촬영 사진, 생성 결과 이미지, 이메일 주소"],
                    ["이용 목적", "AI 네컷사진 생성 및 이메일 발송"],
                    ["보관 기간", "발송 완료 후 즉시 삭제, 오류 대응 시 최대 24시간"],
                    ["외부 서비스", "OpenAI API, Brevo 이메일 API"],
                    ["동의 거부 시", "이메일 발송형 촬영 서비스 이용 불가"],
                    ["만 14세 미만", "보호자 또는 인솔자 동의 필요"],
                  ].map(([label, value]) => (
                    <div key={label} className="grid gap-1 rounded-[4px] border-2 border-[#f4f1e8]/18 px-4 py-3">
                      <p className="text-lg font-black text-[#f4f1e8]/58">{label}</p>
                      <p className="safe-text text-2xl font-black leading-tight text-[#f4f1e8]">{value}</p>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setRequiredConsentAccepted((value) => !value)}
                  className={`grid gap-4 rounded-[4px] border-[3px] p-5 text-left active:translate-y-[2px] ${
                    requiredConsentAccepted
                      ? "border-[#f4f1e8] bg-[#f4f1e8] text-[#050505]"
                      : "border-[#f4f1e8]/72 bg-[#0b0b0b] text-[#f4f1e8]"
                  }`}
                >
                  <div className="flex items-start gap-5">
                    <span
                      className={`mt-1 grid h-14 w-14 shrink-0 place-items-center rounded-[4px] border-[3px] ${
                        requiredConsentAccepted ? "border-[#050505] bg-[#050505] text-[#f4f1e8]" : "border-[#f4f1e8] bg-transparent"
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
                    동의해야 AI 네컷사진 생성 및 이메일 발송 서비스를 이용할 수 있습니다.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setArchiveImageConsent((value) => !value)}
                  className={`grid gap-4 rounded-[4px] border-[3px] p-5 text-left active:translate-y-[2px] ${
                    archiveImageConsent
                      ? "border-[#f4f1e8] bg-[#f4f1e8] text-[#050505]"
                      : "border-[#f4f1e8]/72 bg-[#0b0b0b] text-[#f4f1e8]"
                  }`}
                >
                  <div className="flex items-start gap-5">
                    <span
                      className={`mt-1 grid h-14 w-14 shrink-0 place-items-center rounded-[4px] border-[3px] ${
                        archiveImageConsent ? "border-[#050505] bg-[#050505] text-[#f4f1e8]" : "border-[#f4f1e8] bg-transparent"
                      }`}
                    >
                      {archiveImageConsent && <Check className="h-9 w-9" />}
                    </span>
                    <div className="grid gap-2">
                      <p className="text-2xl font-black tracking-[0.16em] opacity-70">선택</p>
                      <h3 className="safe-text text-3xl font-black leading-tight">
                        행사 홍보 및 결과 전시를 위해 완성 사진 저장에 동의합니다.
                      </h3>
                    </div>
                  </div>
                  <p className={`safe-text text-xl font-bold leading-7 ${archiveImageConsent ? "text-[#050505]/68" : "text-[#f4f1e8]/58"}`}>
                    선택하지 않아도 촬영과 이메일 발송은 진행됩니다. 기본 관리자 기록에는 완성 시간, 선택 키워드, AI 비용, 메일 상태만 남습니다.
                  </p>
                </button>

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
            <div className="grid h-full place-items-center text-[#f4f1e8]">
              <div className="grid w-full max-w-[1180px] gap-8 rounded-[4px] border-[4px] border-[#f4f1e8] bg-[#0b0b0b] p-10 text-center">
                <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-[4px] border-[#f4f1e8]">
                  <Sparkles className="h-16 w-16" />
                </div>
                <div className="grid gap-4">
                  <p className="text-2xl font-black tracking-[0.22em] text-[#f4f1e8]/60">01 분석 안내</p>
                  <h2 className="safe-text text-6xl font-black leading-tight">첫 사진은 배경 생성을 위한 사진입니다</h2>
                  <p className="safe-text mx-auto max-w-[940px] text-3xl font-black leading-snug text-[#f4f1e8]/74">
                    이 사진은 최종 네컷에 들어가지 않습니다. 원하는 테마가 잘 나오도록 포즈, 소품, 손동작을 크게 보여 주세요.
                  </p>
                </div>
                <div className="grid grid-cols-[1fr_220px] gap-5">
                  <KioskButton onClick={beginAnalysisCapture} className="min-h-[118px] text-5xl">
                    확인
                  </KioskButton>
                  <div className="grid place-items-center rounded-[4px] border-[3px] border-[#f4f1e8]/62 px-4 text-3xl font-black">
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
                  <CameraPreview
                    ref={cameraRef}
                    active={cameraActive}
                    onReadyChange={onReadyChange}
                    variant="kiosk"
                  />
                  <div className="absolute bottom-6 left-6 right-6 rounded-[4px] border-[3px] border-[#f4f1e8] bg-[#050505] px-7 py-4 text-center text-3xl font-black text-[#f4f1e8]">
                    {step === "analysis_capture" ? "AI 분석용 1장 촬영" : `${FINAL_CAPTURE_COUNT}장 자동 촬영`}
                  </div>
                </div>
              </div>
              <div className="grid content-center gap-8">
                <StepTitle
                  eyebrow={step === "analysis_capture" ? "01 분석 촬영" : "03 최종 촬영"}
                  title={step === "analysis_capture" ? "분석용 사진" : `${shotIndex}/${FINAL_CAPTURE_COUNT} 사진`}
                  detail={shotStatus}
                  compact
                  right={<div className="rounded-[4px] bg-[#f4f1e8] px-6 py-4 text-2xl font-black text-[#050505]">AUTO</div>}
                />
                <CaptureRail captured={step === "analysis_capture" ? (analysisPhoto ? [analysisPhoto] : []) : capturedPhotos} activeIndex={shotIndex} count={step === "analysis_capture" ? 1 : FINAL_CAPTURE_COUNT} />
                {step === "capture" && backgroundStatus !== "idle" && (
                  <BackgroundProgress status={backgroundStatus} progress={backgroundProgress} error={backgroundError} />
                )}
                <div className="rounded-[4px] border-[3px] border-[#f4f1e8]/78 bg-[#0b0b0b] p-7">
                  <p className="safe-text text-4xl font-black leading-tight">
                    {step === "analysis_capture"
                      ? "먼저 한 장을 찍어 AI가 어울리는 배경 태그를 추천합니다."
                      : "배경 생성은 뒤에서 진행됩니다. 촬영을 먼저 끝내고 6장 중 마음에 드는 4장을 고릅니다."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!error && step === "analysis_loading" && (
            <LoadingPanel
              icon={<Tags className="h-16 w-16 animate-pulse" />}
              title="태그를 만들고 있습니다"
              detail="첫 번째 사진을 기준으로 어울리는 배경 단서를 정리합니다"
            />
          )}

          {!error && step === "tag_select" && analysis && tagSelection && (
            <div className="grid min-h-0 grid-cols-[430px_1fr] gap-9">
              <div className="grid content-center gap-5">
                <div className="overflow-hidden rounded-[4px] border-[3px] border-[#f4f1e8] bg-[#0b0b0b] p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={analysisPhoto ?? capturedPhotos[0]} alt="태그 기준 사진" className="aspect-[3/4] w-full object-cover" />
                </div>
                <p className="text-center text-xl font-black text-[#f4f1e8]/58">1번 사진 기준 태그</p>
              </div>

              <div className="grid content-center gap-7">
                <StepTitle
                  eyebrow="02 특징 선택"
                  title="배경 특징 선택"
                  detail="추천 묶음이 아니라 장면, 분위기, 색감, 효과를 각각 하나씩 고릅니다"
                  compact
                />

                <div className="grid gap-4">
                  {CATEGORIES.map((category) => (
                    <div
                      key={category}
                      className="grid grid-cols-[148px_1fr] items-center gap-4 rounded-[4px] border-[3px] border-[#f4f1e8]/78 bg-[#0b0b0b] p-4"
                    >
                      <div className="grid gap-2">
                        <p className="text-lg font-black tracking-[0.14em] text-[#f4f1e8]/48">특징</p>
                        <h3 className="text-3xl font-black">{CATEGORY_LABELS[category]}</h3>
                        <p className="safe-text rounded-[3px] bg-[#f4f1e8] px-3 py-2 text-lg font-black text-[#050505]">
                          {tagSelection[category]}
                        </p>
                      </div>
                      <div
                        className="grid gap-3"
                        style={{
                          gridTemplateColumns: `repeat(${analysis.recommended_keywords[category].length}, minmax(0, 1fr))`,
                        }}
                      >
                        {analysis.recommended_keywords[category].map((keyword) => {
                          const active = tagSelection[category] === keyword;
                          return (
                            <button
                              key={keyword}
                              type="button"
                              onClick={() => setTagSelection((current) => current && { ...current, [category]: keyword })}
                              className={`min-h-[74px] rounded-[4px] border-[3px] px-3 text-xl font-black active:translate-y-[2px] ${
                                active
                                  ? "border-[#f4f1e8] bg-[#f4f1e8] text-[#050505]"
                                  : "border-[#f4f1e8]/60 bg-transparent text-[#f4f1e8]"
                              }`}
                            >
                              {keyword}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <KioskButton onClick={() => void chooseTagsAndContinue()} className="min-h-[112px] text-4xl">
                  태그 확정 후 촬영
                  <ArrowRight className="h-11 w-11" />
                </KioskButton>
              </div>
            </div>
          )}

          {!error && step === "background_loading" && (
            <div className="grid h-full grid-cols-[1fr_620px] items-center gap-10">
              <div className="grid gap-8 text-[#f4f1e8]">
                <StepTitle
                  eyebrow="02 배경 생성"
                  title={pendingUploadAfterBackground ? "AI 배경 생성 대기 중" : "선택한 태그로 배경을 만들고 있습니다"}
                  detail={
                    pendingUploadAfterBackground
                      ? "배경이 준비되면 선택한 사진 4장을 자동으로 합성합니다."
                      : "촬영은 먼저 진행하고, 여기서는 마지막 준비가 필요할 때만 잠시 기다립니다."
                  }
                  compact
                />
                {tagSelection && (
                  <div className="flex flex-wrap gap-3">
                    {CATEGORIES.map((category) => (
                      <span key={category} className="rounded-[4px] border-2 border-[#f4f1e8]/55 px-5 py-3 text-2xl font-black">
                        {CATEGORY_LABELS[category]}: {tagSelection[category]}
                      </span>
                    ))}
                  </div>
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
                      태그 수정
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
                  detail="마음에 드는 사진 4장을 선택해 주세요. 선택한 순서대로 최종 프레임에 들어갑니다."
                  compact
                />
                <div className="grid min-h-0 grid-cols-3 gap-4">
                  {previewPhotos.map((photo, index) => {
                    const selectedOrder = selectedPhotoIndices.indexOf(index);
                    const selected = selectedOrder !== -1;
                    return (
                      <button
                        key={photo}
                        type="button"
                        onClick={() => togglePhoto(index)}
                        className={`relative overflow-hidden rounded-[4px] border-[4px] bg-[#0b0b0b] active:translate-y-[2px] ${
                          selected ? "border-[#f4f1e8]" : "border-[#f4f1e8]/28"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo} alt={`${index + 1}번 사진`} className="aspect-[3/4] h-full w-full object-cover" />
                        <span className="absolute left-3 top-3 rounded-[3px] bg-[#050505] px-3 py-1 text-xl font-black text-[#f4f1e8]">
                          {index + 1}
                        </span>
                        {selected && (
                          <span className="absolute right-3 top-3 grid h-12 w-12 place-items-center rounded-full bg-[#f4f1e8] text-2xl font-black text-[#050505]">
                            {selectedOrder + 1}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid content-center gap-5">
                <BackgroundProgress status={backgroundStatus} progress={backgroundProgress} error={backgroundError} />
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
                      태그 수정
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
                        ? "선택 완료"
                        : "선택 완료 후 배경 대기"}
                  </KioskButton>
                )}
              </div>
            </div>
          )}

          {!error && step === "uploading" && (
            <LoadingPanel
              icon={<Wand2 className="h-16 w-16 animate-pulse" />}
              title="사진을 정리하고 있습니다"
              detail={uploadStatus || "선택한 사진을 보정하고 저장합니다"}
            />
          )}

          {!error && step === "compose" && (
            <LoadingPanel
              icon={<Camera className="h-16 w-16 animate-pulse" />}
              title="네컷 사진을 만들고 있습니다"
              detail="선택한 4장과 배경을 최종 프레임에 맞춰 합성합니다"
            />
          )}

          {!error && step === "result" && finalUrl && (
            <div className="grid min-h-0 grid-cols-[620px_1fr] gap-10">
              <div className="grid min-h-0 place-items-center">
                <div className="h-full max-h-[900px] rounded-[4px] border-[4px] border-[#f4f1e8] bg-[#050505] p-4">
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
                <div className="grid gap-5">
                  <KioskButton onClick={() => setStep("email")} className="min-h-[128px] text-5xl">
                    <Mail className="h-14 w-14" />
                    메일 입력
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
            <div className="grid min-h-0 grid-cols-[480px_1fr] gap-8">
              <div className="grid content-center gap-8">
                <StepTitle
                  eyebrow="04 메일 입력"
                  title="메일 주소 입력"
                  detail="@ 앞부분을 입력하고 도메인을 선택하면 완성본을 전송합니다"
                  compact
                />
                <div className="rounded-[4px] border-[3px] border-[#f4f1e8]/78 bg-[#0b0b0b] p-6 text-2xl font-black leading-snug">
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

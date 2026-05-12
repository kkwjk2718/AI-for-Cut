export type KeywordCategory = "theme" | "mood" | "color" | "effect";

export type KeywordSet = Record<KeywordCategory, string[]>;

export type SelectedKeywords = Record<KeywordCategory, string>;

export type SessionState =
  | "created"
  | "analysis_captured"
  | "keywords_ready"
  | "background_ready"
  | "photos_captured"
  | "composited"
  | "emailed"
  | "expired";

export interface PoseAnalysis {
  people_count: number;
  pose_summary: string;
  recommended_keywords: KeywordSet;
  ui_caption: string;
  usedFallback?: boolean;
}

export interface SessionFiles {
  analysisImage?: string;
  background?: string;
  shots: string[];
  final?: string;
}

export type AiCostKind = "pose_analysis" | "background_generation";

export interface AiCostLine {
  id: string;
  kind: AiCostKind;
  label: string;
  model: string;
  createdAt: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputUsdPer1M: number;
  cachedInputUsdPer1M: number;
  outputUsdPer1M: number;
  costUsd: number;
  pricingNote?: string;
}

export interface AiCostSummary {
  currency: "USD";
  totalUsd: number;
  lines: AiCostLine[];
}

export interface BoothSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  state: SessionState;
  files: SessionFiles;
  recommendations?: PoseAnalysis;
  selectedKeywords?: SelectedKeywords;
  aiCost?: AiCostSummary;
  emailSentAt?: string;
}

export interface AdminPhotoRecord {
  id: string;
  sessionId: string;
  createdAt: string;
  completedAt: string;
  updatedAt: string;
  imageFile: string;
  width: number;
  height: number;
  selectedKeywords?: SelectedKeywords;
  poseSummary?: string;
  aiCost: AiCostSummary;
  email?: {
    sentAt: string;
    skipped: boolean;
    hasMessageId: boolean;
  };
}

export interface ApiOk<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
}

export type ApiResponse<T> = ApiOk<T> | ApiError;

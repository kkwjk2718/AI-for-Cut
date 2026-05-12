import { randomUUID } from "crypto";
import type { AiCostKind, AiCostLine, AiCostSummary, BoothSession } from "./types";

interface TokenUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface CostRates {
  inputUsdPer1M: number;
  cachedInputUsdPer1M: number;
  outputUsdPer1M: number;
}

const DEFAULT_RATES: Record<AiCostKind, CostRates> = {
  pose_analysis: {
    inputUsdPer1M: 0.75,
    cachedInputUsdPer1M: 0.075,
    outputUsdPer1M: 4.5,
  },
  background_generation: {
    inputUsdPer1M: 5,
    cachedInputUsdPer1M: 1.25,
    outputUsdPer1M: 30,
  },
};

const RATE_ENV: Record<AiCostKind, Record<keyof CostRates, string>> = {
  pose_analysis: {
    inputUsdPer1M: "OPENAI_ANALYSIS_INPUT_USD_PER_1M",
    cachedInputUsdPer1M: "OPENAI_ANALYSIS_CACHED_INPUT_USD_PER_1M",
    outputUsdPer1M: "OPENAI_ANALYSIS_OUTPUT_USD_PER_1M",
  },
  background_generation: {
    inputUsdPer1M: "OPENAI_IMAGE_TEXT_INPUT_USD_PER_1M",
    cachedInputUsdPer1M: "OPENAI_IMAGE_TEXT_CACHED_INPUT_USD_PER_1M",
    outputUsdPer1M: "OPENAI_IMAGE_OUTPUT_USD_PER_1M",
  },
};

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function ratesFor(kind: AiCostKind): CostRates {
  const defaults = DEFAULT_RATES[kind];
  const env = RATE_ENV[kind];
  return {
    inputUsdPer1M: envNumber(env.inputUsdPer1M, defaults.inputUsdPer1M),
    cachedInputUsdPer1M: envNumber(env.cachedInputUsdPer1M, defaults.cachedInputUsdPer1M),
    outputUsdPer1M: envNumber(env.outputUsdPer1M, defaults.outputUsdPer1M),
  };
}

function numberFrom(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function extractOpenAiUsage(payload: unknown): TokenUsage | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const usage = (payload as { usage?: unknown }).usage;
  if (!usage || typeof usage !== "object") {
    return undefined;
  }

  const usageObject = usage as {
    input_tokens?: unknown;
    output_tokens?: unknown;
    total_tokens?: unknown;
    input_tokens_details?: { cached_tokens?: unknown };
  };
  const inputTokens = numberFrom(usageObject.input_tokens);
  const outputTokens = numberFrom(usageObject.output_tokens);
  const cachedInputTokens = numberFrom(usageObject.input_tokens_details?.cached_tokens);
  const totalTokens = numberFrom(usageObject.total_tokens) || inputTokens + outputTokens;

  if (inputTokens === 0 && outputTokens === 0 && totalTokens === 0) {
    return undefined;
  }

  return {
    inputTokens,
    cachedInputTokens,
    outputTokens,
    totalTokens,
  };
}

export function createCostLine(
  kind: AiCostKind,
  label: string,
  model: string,
  usage: TokenUsage | undefined,
): AiCostLine | undefined {
  if (!usage) {
    return undefined;
  }

  const rates = ratesFor(kind);
  const regularInputTokens = Math.max(usage.inputTokens - usage.cachedInputTokens, 0);
  const costUsd =
    (regularInputTokens / 1_000_000) * rates.inputUsdPer1M +
    (usage.cachedInputTokens / 1_000_000) * rates.cachedInputUsdPer1M +
    (usage.outputTokens / 1_000_000) * rates.outputUsdPer1M;

  return {
    id: randomUUID(),
    kind,
    label,
    model,
    createdAt: new Date().toISOString(),
    inputTokens: usage.inputTokens,
    cachedInputTokens: usage.cachedInputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    inputUsdPer1M: rates.inputUsdPer1M,
    cachedInputUsdPer1M: rates.cachedInputUsdPer1M,
    outputUsdPer1M: rates.outputUsdPer1M,
    costUsd,
    pricingNote: "Estimated from OpenAI usage tokens and configured USD-per-1M-token rates.",
  };
}

export function createFixedCostLine(
  kind: AiCostKind,
  label: string,
  model: string,
  costUsd: number,
  pricingNote: string,
): AiCostLine {
  return {
    id: randomUUID(),
    kind,
    label,
    model,
    createdAt: new Date().toISOString(),
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    inputUsdPer1M: 0,
    cachedInputUsdPer1M: 0,
    outputUsdPer1M: 0,
    costUsd: Math.max(costUsd, 0),
    pricingNote,
  };
}

export function summarizeCost(lines: AiCostLine[] = []): AiCostSummary {
  return {
    currency: "USD",
    totalUsd: lines.reduce((sum, line) => sum + line.costUsd, 0),
    lines,
  };
}

export function addCostLine(session: BoothSession, line: AiCostLine | undefined): void {
  if (!line) {
    return;
  }

  const lines = [...(session.aiCost?.lines ?? []), line];
  session.aiCost = summarizeCost(lines);
}

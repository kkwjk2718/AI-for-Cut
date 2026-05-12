import sharp from "sharp";
import { createCostLine, createFixedCostLine, extractOpenAiUsage } from "./costs";
import { logError, logEvent } from "./event-log";
import { FALLBACK_ANALYSIS, normalizeAnalysis } from "./keywords";
import { backgroundPrompt, POSE_ANALYSIS_SYSTEM_PROMPT, poseAnalysisUserPrompt } from "./prompts";
import type { AiCostLine, PoseAnalysis, SelectedKeywords } from "./types";

function apiKey(): string | undefined {
  return process.env.OPENAI_API_KEY?.trim();
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isOpenAiConfigured(): boolean {
  return Boolean(apiKey());
}

function analysisModel(): string {
  return process.env.OPENAI_ANALYSIS_MODEL || "gpt-5.4-mini";
}

function imageModel(): string {
  return process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
}

function imageFixedCostUsd(): number {
  const value = Number(process.env.OPENAI_IMAGE_FIXED_COST_USD_1024x1536_MEDIUM);
  return Number.isFinite(value) && value >= 0 ? value : 0.041;
}

function extractOutputText(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const response = payload as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ text?: unknown; type?: unknown }> }>;
  };

  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") {
        return content.text;
      }
    }
  }

  return undefined;
}

export async function prepareAnalysisImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

export async function analyzePose(
  imageBuffer: Buffer,
): Promise<{ analysis: PoseAnalysis; costLine?: AiCostLine }> {
  const key = apiKey();
  if (!key) {
    if (isProduction()) {
      throw new Error("OpenAI is not configured.");
    }
    return { analysis: FALLBACK_ANALYSIS };
  }

  try {
    const imageData = `data:image/jpeg;base64,${imageBuffer.toString("base64")}`;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: analysisModel(),
        input: [
          {
            role: "developer",
            content: [{ type: "input_text", text: POSE_ANALYSIS_SYSTEM_PROMPT }],
          },
          {
            role: "user",
            content: [
              { type: "input_text", text: poseAnalysisUserPrompt() },
              { type: "input_image", image_url: imageData },
            ],
          },
        ],
        text: {
          format: {
            type: "json_object",
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI analysis failed: ${response.status}`);
    }

    const payload = await response.json();
    const text = extractOutputText(payload);
    if (!text) {
      throw new Error("OpenAI analysis returned no text.");
    }

    return {
      analysis: normalizeAnalysis(JSON.parse(text)),
      costLine: createCostLine(
        "pose_analysis",
        "Pose analysis",
        analysisModel(),
        extractOpenAiUsage(payload),
      ),
    };
  } catch (error) {
    await logError("openai_pose_analysis_failed", {
      model: analysisModel(),
      fallbackUsed: !isProduction(),
      message: error instanceof Error ? error.message : "unknown",
    });
    if (isProduction()) {
      throw error instanceof Error ? error : new Error("OpenAI analysis failed.");
    }
    return { analysis: FALLBACK_ANALYSIS };
  }
}

function paletteFor(color: string): { a: string; b: string; c: string; d: string } {
  const palettes: Record<string, { a: string; b: string; c: string; d: string }> = {
    파랑: { a: "#103d65", b: "#2bb3c0", c: "#f7f5f0", d: "#f6c84c" },
    보라: { a: "#342151", b: "#8f6bdc", c: "#f7f5f0", d: "#26b99a" },
    핑크: { a: "#7a3159", b: "#f6a5b7", c: "#f7f5f0", d: "#2bb3c0" },
    네온: { a: "#161719", b: "#26b99a", c: "#f36b4f", d: "#f6c84c" },
    검정: { a: "#15171a", b: "#4b5563", c: "#f7f5f0", d: "#26b99a" },
    금색: { a: "#5f4725", b: "#f6c84c", c: "#f7f5f0", d: "#2bb3c0" },
    초록: { a: "#174c3b", b: "#26b99a", c: "#f7f5f0", d: "#f36b4f" },
    무지개: { a: "#293241", b: "#ee6c4d", c: "#98c1d9", d: "#f6c84c" },
    흰색: { a: "#d8d3c8", b: "#f7f5f0", c: "#2bb3c0", d: "#f36b4f" },
    파스텔: { a: "#f2d7d5", b: "#c7e8df", c: "#f7f5f0", d: "#f6c84c" },
  };
  return palettes[color] ?? palettes.파랑;
}

async function fallbackBackground(selected: SelectedKeywords): Promise<Buffer> {
  const p = paletteFor(selected.color);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.a}"/>
      <stop offset="48%" stop-color="${p.b}"/>
      <stop offset="100%" stop-color="${p.c}"/>
    </linearGradient>
    <radialGradient id="light" cx="50%" cy="36%" r="42%">
      <stop offset="0%" stop-color="${p.c}" stop-opacity="0.76"/>
      <stop offset="72%" stop-color="${p.c}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1536" fill="url(#bg)"/>
  <rect x="96" y="156" width="832" height="1204" rx="72" fill="url(#light)" opacity="0.9"/>
  <g fill="none" stroke="${p.d}" stroke-opacity="0.55" stroke-width="5">
    <ellipse cx="210" cy="270" rx="132" ry="42" transform="rotate(-24 210 270)"/>
    <ellipse cx="210" cy="270" rx="132" ry="42" transform="rotate(24 210 270)"/>
    <circle cx="210" cy="270" r="14" fill="${p.d}" stroke="none"/>
    <path d="M790 210c70 42 88 104 42 152s-124 58-184 18" stroke-linecap="round"/>
    <path d="M138 1220c112-84 210-82 294 6s186 82 308-18" stroke-linecap="round"/>
  </g>
  <g fill="${p.c}" fill-opacity="0.72">
    <circle cx="126" cy="468" r="7"/>
    <circle cx="872" cy="432" r="9"/>
    <circle cx="778" cy="1058" r="6"/>
    <circle cx="252" cy="1008" r="8"/>
    <circle cx="514" cy="170" r="5"/>
    <circle cx="922" cy="1222" r="7"/>
  </g>
  <g stroke="${p.c}" stroke-opacity="0.28" stroke-width="2">
    <path d="M128 618h768M128 718h768M128 818h768M128 918h768"/>
    <path d="M244 520v596M364 520v596M484 520v596M604 520v596M724 520v596"/>
  </g>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function generateBackground(
  selected: SelectedKeywords,
): Promise<{ buffer: Buffer; usedFallback: boolean; costLine?: AiCostLine }> {
  const key = apiKey();
  if (!key) {
    if (isProduction()) {
      throw new Error("OpenAI is not configured.");
    }
    return { buffer: await fallbackBackground(selected), usedFallback: true };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: imageModel(),
        prompt: backgroundPrompt(selected),
        size: "1024x1536",
        quality: "medium",
        n: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI image generation failed: ${response.status}`);
    }

    const payload = (await response.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
      usage?: unknown;
    };
    const costLine =
      createCostLine(
        "background_generation",
        "Background generation",
        imageModel(),
        extractOpenAiUsage(payload),
      ) ??
      createFixedCostLine(
        "background_generation",
        "Background generation",
        imageModel(),
        imageFixedCostUsd(),
        "Estimated from configured fixed image price because OpenAI image usage tokens were not returned.",
      );
    const image = payload.data?.[0];
    if (image?.b64_json) {
      await logEvent("openai_background_generated", { model: imageModel(), pricing: costLine.pricingNote ?? null });
      return { buffer: Buffer.from(image.b64_json, "base64"), usedFallback: false, costLine };
    }
    if (image?.url) {
      const imageResponse = await fetch(image.url);
      if (!imageResponse.ok) {
        throw new Error("Generated image URL could not be fetched.");
      }
      await logEvent("openai_background_generated", { model: imageModel(), pricing: costLine.pricingNote ?? null });
      return {
        buffer: Buffer.from(await imageResponse.arrayBuffer()),
        usedFallback: false,
        costLine,
      };
    }
    throw new Error("OpenAI image generation returned no image.");
  } catch (error) {
    await logError("openai_background_failed", {
      model: imageModel(),
      fallbackUsed: !isProduction(),
      message: error instanceof Error ? error.message : "unknown",
    });
    if (isProduction()) {
      throw error instanceof Error ? error : new Error("OpenAI image generation failed.");
    }
    return { buffer: await fallbackBackground(selected), usedFallback: true };
  }
}

import { ALLOWED_KEYWORDS, KEYWORD_LABELS, RECOMMENDED_KEYWORD_COUNT } from "./keywords";
import type { SelectedKeywords } from "./types";

export const POSE_ANALYSIS_SYSTEM_PROMPT = `You are an assistant for an AI photo booth at a science festival.
Analyze the user's pose and overall mood from the given image.
Return only valid JSON.
Use only the allowed keyword sets provided by the developer.
Recommend exactly ${RECOMMENDED_KEYWORD_COUNT} diverse keywords for each category: theme, mood, color, effect.
Treat theme as the background setting. Include booth-friendly theme options such as 기본, 우주, 동굴, 바다, then add visually fitting science-festival choices from the allowed set.
Avoid near-duplicates inside the same category. Mix safe science-festival concepts with visually distinct styles.
Keep the result family-friendly, science-festival-appropriate, and visually useful for background generation.`;

export function poseAnalysisUserPrompt(): string {
  return `Allowed keyword sets:
${JSON.stringify(ALLOWED_KEYWORDS, null, 2)}

Return this JSON shape:
{
  "people_count": number,
  "pose_summary": "short Korean summary",
  "recommended_keywords": {
    "theme": ["string", "string", "string", "string", "string", "string"],
    "mood": ["string", "string", "string", "string", "string", "string"],
    "color": ["string", "string", "string", "string", "string", "string"],
    "effect": ["string", "string", "string", "string", "string", "string"]
  },
  "ui_caption": "short Korean caption"
}`;
}

export function backgroundPrompt(selected: SelectedKeywords): string {
  return `Create a vertical photobooth background for a science festival.

${KEYWORD_LABELS.theme}: ${selected.theme}
${KEYWORD_LABELS.mood}: ${selected.mood}
${KEYWORD_LABELS.color}: ${selected.color}
${KEYWORD_LABELS.effect}: ${selected.effect}

Requirements:
- Background only
- No people
- No faces
- No readable text
- Suitable for compositing people in front
- Visually appealing for a four-cut photo booth
- Science festival style
- Keep the center area relatively clean for subject placement`;
}

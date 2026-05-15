import { ALLOWED_KEYWORDS, KEYWORD_LABELS, RECOMMENDED_KEYWORD_COUNTS } from "./keywords";
import type { SelectedKeywords } from "./types";

export const POSE_ANALYSIS_SYSTEM_PROMPT = `You are an assistant for an AI photo booth at a science festival.
Analyze the user's pose and overall mood from the given image.
Return only valid JSON.
Use only the allowed keyword sets provided by the developer.
Recommend exactly ${RECOMMENDED_KEYWORD_COUNTS.theme} theme keywords, ${RECOMMENDED_KEYWORD_COUNTS.mood} mood keywords, ${RECOMMENDED_KEYWORD_COUNTS.color} color keywords, and ${RECOMMENDED_KEYWORD_COUNTS.effect} effect keywords.
Treat theme as the main background world/setting, not a generic genre label.
The six theme keywords must be visually diverse. Avoid recommending several near-neighbors together, such as 과학, AI, 로봇, 실험실, 미래도시, and 과학축제 in the same list.
Prefer concrete places or worlds over abstract words. Good theme variety mixes categories like outer space, underwater, cave/ruins, nature, city/stage, classroom/library/museum, and science lab.
Only use generic themes such as 과학, AI, 공학, or 과학축제 when the pose strongly calls for them; otherwise choose more concrete settings such as 심해기지, 크리스탈동굴, 정글, 사이버거리, 도서관, 사막행성, 구름섬, or 빛터널.
Order the first theme as the best pose-based recommendation, then fill the rest with different-looking alternatives.
Avoid near-duplicates inside every category. Mix safe science-festival concepts with visually distinct styles.
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
    "mood": ["string", "string", "string", "string"],
    "color": ["string", "string", "string", "string"],
    "effect": ["string", "string", "string", "string"]
  },
  "ui_caption": "short Korean caption"
}

Theme diversity examples:
- Good: ["우주", "심해기지", "크리스탈동굴", "정글", "사이버거리", "도서관"]
- Good: ["로켓", "바다", "고대유적", "구름섬", "게임월드", "수학 교실"]
- Bad: ["과학", "AI", "로봇", "실험실", "미래도시", "과학축제"] because they look too similar in the kiosk UI.`;
}

function themeVisualGuidance(theme: string): string {
  const guidance: Record<string, string> = {
    기본: "clean studio-style festival backdrop with subtle science shapes",
    우주: "deep space observatory, planets, stars, and cosmic depth",
    동굴: "dark cave chamber with dramatic rim light and mineral textures",
    크리스탈동굴: "glowing crystal cave with translucent gems and colored refractions",
    바다: "bright ocean surface, bubbles, waves, and soft aquatic light",
    심해: "deep sea environment with dark blue water, bioluminescence, and floating particles",
    심해기지: "underwater research base with glass tunnels and bioluminescent sea life",
    숲: "lush forest with layered leaves, sunlight beams, and natural depth",
    정글: "dense tropical jungle expedition scene with vines and oversized leaves",
    도시: "modern city street with architectural depth and clean night lighting",
    사이버거리: "cyberpunk neon street with signs implied as abstract shapes, wet reflections, and depth",
    별하늘: "wide night sky full of stars, soft horizon glow, and dreamy atmosphere",
    교실: "stylized classroom backdrop with desks, boards, and soft academic light",
    도서관: "grand library with tall shelves, warm lamps, and quiet study atmosphere",
    박물관: "science museum hall with exhibits, display plinths, and polished lighting",
    무대: "concert-like photo stage with spotlights and dramatic backdrop curtains",
    게임월드: "playful arcade game world with geometric platforms and bright depth",
    로켓: "rocket launch pad with smoke, gantry silhouettes, and dynamic upward energy",
    사막행성: "orange desert planet with dunes, twin moons, and sci-fi expedition mood",
    얼음왕국: "icy blue palace landscape with frost, snow sparkle, and crystalline surfaces",
    구름섬: "floating cloud islands with bright sky, soft mist, and airy fantasy depth",
    빛터널: "tunnel of light with perspective lines, glowing particles, and motion energy",
    고대유적: "ancient ruins with stone arches, mysterious light, and explorer mood",
    마법연구실: "fantasy science lab with glowing bottles, instruments, and magical light",
    과학: "science fair laboratory stage with abstract instruments and clean educational energy",
    AI: "AI data space with soft holographic panels, abstract neural light, and no readable text",
    로봇: "robotics workshop with mechanical silhouettes, tools, and friendly futuristic lights",
    실험실: "modern science laboratory with glassware silhouettes, clean benches, and glowing accents",
    미래도시: "futuristic skyline with depth, elevated paths, and clean neon accents",
    천체관측: "astronomy observation deck with telescope silhouettes and star maps as abstract lines",
    "수학 교실": "math classroom with abstract formulas as decorative shapes, desks, and warm light",
    천문대: "observatory dome interior with telescope, starry opening, and cinematic lighting",
    구름: "soft cloudscape with pastel sky, light shafts, and gentle depth",
    오로라: "aurora sky with flowing green and violet light above a dark horizon",
    화학: "chemistry-inspired backdrop with glassware silhouettes, color gradients, and safe lab mood",
    DNA: "bio-science backdrop with DNA helix forms, soft molecular shapes, and clean depth",
    공학: "engineering workshop with blueprint-like geometry, gears, and structural lines",
    과학축제: "lively science festival booth backdrop with abstract displays, lights, and celebratory energy",
  };

  return guidance[theme] ?? "distinct, concrete, visually rich setting based on the selected theme";
}

export function backgroundPrompt(selected: SelectedKeywords): string {
  return `Create a vertical photobooth background for a science festival.

${KEYWORD_LABELS.theme}: ${selected.theme}
${KEYWORD_LABELS.mood}: ${selected.mood}
${KEYWORD_LABELS.color}: ${selected.color}
${KEYWORD_LABELS.effect}: ${selected.effect}

Main setting guidance:
${themeVisualGuidance(selected.theme)}

Requirements:
- Background only
- No people
- No faces
- No readable text
- Suitable for compositing people in front
- Visually appealing for a four-cut photo booth
- Science festival style
- Make the selected theme the dominant visual setting. Do not collapse every theme into a generic neon laboratory.
- Keep the center area relatively clean for subject placement`;
}

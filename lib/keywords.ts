import type { KeywordCategory, KeywordSet, PoseAnalysis, SelectedKeywords } from "./types";

export const KEYWORD_LABELS: Record<KeywordCategory, string> = {
  theme: "테마",
  mood: "분위기",
  color: "색감",
  effect: "효과",
};

export const RECOMMENDED_KEYWORD_COUNT = 6;

export const THEME_PRESET_KEYWORDS = ["기본", "우주", "동굴", "바다"] as const;

export const ALLOWED_KEYWORDS: KeywordSet = {
  theme: [
    "기본",
    "우주",
    "동굴",
    "바다",
    "숲",
    "도시",
    "별하늘",
    "교실",
    "무대",
    "로켓",
    "과학",
    "AI",
    "로봇",
    "실험실",
    "미래도시",
    "천체관측",
    "수학 교실",
    "천문대",
    "심해",
    "구름",
    "오로라",
    "화학",
    "DNA",
    "공학",
    "과학축제",
  ],
  mood: [
    "신비로운",
    "역동적인",
    "차분한",
    "반짝이는",
    "사이버",
    "따뜻한",
    "발랄한",
    "미래적인",
    "지적인",
    "즐거운",
  ],
  color: [
    "파랑",
    "보라",
    "핑크",
    "네온",
    "검정",
    "금색",
    "초록",
    "무지개",
    "흰색",
    "파스텔",
  ],
  effect: [
    "별빛",
    "로켓",
    "수식",
    "DNA",
    "홀로그램",
    "기어",
    "빛줄기",
    "전기 스파크",
    "행성",
    "칠판",
    "글리터",
  ],
};

export const FALLBACK_ANALYSIS: PoseAnalysis = {
  people_count: 1,
  pose_summary: "밝고 즐거운 포즈",
  recommended_keywords: {
    theme: ALLOWED_KEYWORDS.theme.slice(0, RECOMMENDED_KEYWORD_COUNT),
    mood: ALLOWED_KEYWORDS.mood.slice(0, RECOMMENDED_KEYWORD_COUNT),
    color: ALLOWED_KEYWORDS.color.slice(0, RECOMMENDED_KEYWORD_COUNT),
    effect: ALLOWED_KEYWORDS.effect.slice(0, RECOMMENDED_KEYWORD_COUNT),
  },
  ui_caption: "포즈에 어울리는 과학축제 배경 키워드를 준비했어요.",
  usedFallback: true,
};

export const DEFAULT_SELECTED_KEYWORDS: SelectedKeywords = {
  theme: FALLBACK_ANALYSIS.recommended_keywords.theme[0],
  mood: FALLBACK_ANALYSIS.recommended_keywords.mood[0],
  color: FALLBACK_ANALYSIS.recommended_keywords.color[0],
  effect: FALLBACK_ANALYSIS.recommended_keywords.effect[0],
};

export function normalizeAnalysis(input: unknown): PoseAnalysis {
  if (!input || typeof input !== "object") {
    return FALLBACK_ANALYSIS;
  }

  const source = input as Partial<PoseAnalysis>;
  const recommended = source.recommended_keywords ?? {};

  const normalizedKeywords = (Object.keys(ALLOWED_KEYWORDS) as KeywordCategory[]).reduce(
    (acc, category) => {
      const rawValues = (recommended as Partial<KeywordSet>)[category];
      const values = Array.isArray(rawValues) ? rawValues : [];
      const allowed = ALLOWED_KEYWORDS[category];
      const clean = values
        .filter((value): value is string => typeof value === "string")
        .filter((value) => allowed.includes(value))
        .slice(0, RECOMMENDED_KEYWORD_COUNT);
      const pinned = category === "theme" ? [...THEME_PRESET_KEYWORDS] : [];
      const merged = [...pinned, ...clean, ...allowed].filter(
        (value, index, array) => array.indexOf(value) === index,
      );

      acc[category] = merged.slice(0, RECOMMENDED_KEYWORD_COUNT);
      return acc;
    },
    {} as KeywordSet,
  );

  return {
    people_count:
      typeof source.people_count === "number" && Number.isFinite(source.people_count)
        ? Math.max(0, Math.min(12, Math.round(source.people_count)))
        : FALLBACK_ANALYSIS.people_count,
    pose_summary:
      typeof source.pose_summary === "string" && source.pose_summary.trim()
        ? source.pose_summary.trim().slice(0, 180)
        : FALLBACK_ANALYSIS.pose_summary,
    recommended_keywords: normalizedKeywords,
    ui_caption:
      typeof source.ui_caption === "string" && source.ui_caption.trim()
        ? source.ui_caption.trim().slice(0, 120)
        : FALLBACK_ANALYSIS.ui_caption,
    usedFallback: false,
  };
}

export function selectedFromAnalysis(analysis: PoseAnalysis): SelectedKeywords {
  return {
    theme: analysis.recommended_keywords.theme[0],
    mood: analysis.recommended_keywords.mood[0],
    color: analysis.recommended_keywords.color[0],
    effect: analysis.recommended_keywords.effect[0],
  };
}

export function validateSelectedKeywords(value: unknown): SelectedKeywords {
  if (!value || typeof value !== "object") {
    return DEFAULT_SELECTED_KEYWORDS;
  }

  const source = value as Partial<SelectedKeywords>;
  return (Object.keys(ALLOWED_KEYWORDS) as KeywordCategory[]).reduce((acc, category) => {
    const keyword = source[category];
    acc[category] =
      typeof keyword === "string" && ALLOWED_KEYWORDS[category].includes(keyword)
        ? keyword
        : DEFAULT_SELECTED_KEYWORDS[category];
    return acc;
  }, {} as SelectedKeywords);
}

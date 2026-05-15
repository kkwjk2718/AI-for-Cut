export const FRAME_COLOR_OPTIONS = [
  { id: "black", label: "검정", value: "#050505", textColor: "#f4f1e8", borderColor: "#f8fafc" },
  { id: "white", label: "흰색", value: "#f8fafc", textColor: "#050505", borderColor: "#050505" },
  { id: "gray", label: "회색", value: "#9ca3af", textColor: "#050505", borderColor: "#050505" },
  { id: "pastel-pink", label: "파스텔 핑크", value: "#f8c8dc", textColor: "#050505", borderColor: "#050505" },
  { id: "pastel-peach", label: "파스텔 피치", value: "#ffd1ba", textColor: "#050505", borderColor: "#050505" },
  { id: "pastel-yellow", label: "파스텔 옐로", value: "#fff4a3", textColor: "#050505", borderColor: "#050505" },
  { id: "pastel-mint", label: "파스텔 민트", value: "#b8f2d0", textColor: "#050505", borderColor: "#050505" },
  { id: "pastel-sky", label: "파스텔 스카이", value: "#a7d8ff", textColor: "#050505", borderColor: "#050505" },
  { id: "pastel-lavender", label: "파스텔 라벤더", value: "#cdb4db", textColor: "#050505", borderColor: "#050505" },
] as const;

export type FrameColorId = (typeof FRAME_COLOR_OPTIONS)[number]["id"];
export type FrameColorOption = (typeof FRAME_COLOR_OPTIONS)[number];

export const DEFAULT_FRAME_COLOR_ID: FrameColorId = "black";

export function getFrameColorOption(id: string | undefined | null): FrameColorOption {
  return FRAME_COLOR_OPTIONS.find((option) => option.id === id) ?? FRAME_COLOR_OPTIONS[0];
}

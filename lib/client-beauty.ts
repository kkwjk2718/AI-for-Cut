"use client";

import { applyBanubaBeautyFilter } from "@/lib/client-banuba-beauty";

export type BeautyStrength = 0 | 1 | 2 | 3 | 4;

export const BEAUTY_OPTIONS: Array<{
  value: BeautyStrength;
  label: string;
  caption: string;
}> = [
  { value: 0, label: "0단계", caption: "원본" },
  { value: 1, label: "1단계", caption: "자연" },
  { value: 2, label: "2단계", caption: "기본" },
  { value: 3, label: "3단계", caption: "화사" },
  { value: 4, label: "4단계", caption: "강함" },
];

export async function applyBeautyFilter(dataUrl: string, strength: BeautyStrength): Promise<string> {
  if (strength === 0) {
    return dataUrl;
  }

  const banubaResult = await applyBanubaBeautyFilter(dataUrl, strength);
  return banubaResult ?? dataUrl;
}

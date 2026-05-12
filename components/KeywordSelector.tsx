"use client";

import type { KeywordCategory, PoseAnalysis, SelectedKeywords } from "@/lib/types";
import { KEYWORD_LABELS } from "@/lib/keywords";

interface KeywordSelectorProps {
  analysis: PoseAnalysis;
  selected: SelectedKeywords;
  onChange: (selected: SelectedKeywords) => void;
}

const CATEGORIES: KeywordCategory[] = ["theme", "mood", "color", "effect"];

export function KeywordSelector({ analysis, selected, onChange }: KeywordSelectorProps) {
  return (
    <div className="grid gap-5">
      <p className="safe-text rounded-[8px] border-2 border-booth-ink bg-white p-4 text-sm font-semibold">
        {analysis.ui_caption}
      </p>
      {CATEGORIES.map((category) => (
        <section key={category} className="grid gap-3">
          <h3 className="text-base font-black">{KEYWORD_LABELS[category]}</h3>
          <div className="grid grid-cols-3 gap-2">
            {analysis.recommended_keywords[category].map((keyword) => {
              const active = selected[category] === keyword;
              return (
                <button
                  key={keyword}
                  type="button"
                  onClick={() => onChange({ ...selected, [category]: keyword })}
                  className={`min-h-12 rounded-[8px] border-2 px-3 text-sm font-black transition ${
                    active
                      ? "border-booth-ink bg-booth-lemon text-booth-ink"
                      : "border-booth-line bg-white text-booth-ink hover:border-booth-ink"
                  }`}
                >
                  <span className="safe-text block">{keyword}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

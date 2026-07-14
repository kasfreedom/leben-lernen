import { describe, expect, it } from "vitest";
import { hasPromptTranslation } from "../src/domain/support-quality";
import type { LearningSupport } from "../src/domain/types";

const baseSupport: LearningSupport = {
  questionId: "general-1",
  locale: "en",
  translation: "In Germany, people may openly say something against the government because ...",
  correctAnswerTranslation: "freedom of expression applies here",
  simpleExplanation: "Freedom of expression is protected.",
  vocabulary: [{ source: "Meinungsfreiheit", translation: "freedom of expression" }]
};

describe("support quality", () => {
  it("accepts verified prompt translations", () => {
    expect(hasPromptTranslation(baseSupport)).toBe(true);
  });

  it("rejects generated English study guides as prompt translations", () => {
    expect(hasPromptTranslation({
      ...baseSupport,
      translation: "English study guide: Deutschland = Germany; Wahl = election."
    })).toBe(false);
  });

  it("rejects generated Arabic study guides as prompt translations", () => {
    expect(hasPromptTranslation({
      ...baseSupport,
      locale: "ar",
      translation: "دليل دراسة اللغة الإنجليزية: Deutschland = ألمانيا."
    })).toBe(false);
  });
});

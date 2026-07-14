import type { LearningSupport } from "./types";

const GENERATED_TRANSLATION_MARKERS = [
  "English study guide:",
  "دليل دراسة",
  "دليل الدراسة"
] as const;

export function hasPromptTranslation(support: LearningSupport | undefined): support is LearningSupport {
  if (!support) return false;
  const translation = support.translation.trim();
  if (!translation) return false;
  return !GENERATED_TRANSLATION_MARKERS.some((marker) => translation.includes(marker));
}

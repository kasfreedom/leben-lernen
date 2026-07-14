import type { PracticeMode } from "./types";

const DEFAULT_MODE: PracticeMode = "practice";
const MODE_HASHES: Readonly<Record<PracticeMode, string>> = {
  practice: "#/practice",
  language: "#/language",
  mock: "#/mock",
  progress: "#/progress"
};

const MODES_BY_HASH = new Map(
  Object.entries(MODE_HASHES).map(([mode, hash]) => [hash, mode as PracticeMode])
);

export function hashForMode(mode: PracticeMode): string {
  return MODE_HASHES[mode];
}

export function modeFromHash(hash: string): PracticeMode {
  return MODES_BY_HASH.get(hash) ?? DEFAULT_MODE;
}

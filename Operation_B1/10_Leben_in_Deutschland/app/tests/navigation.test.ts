import { describe, expect, it } from "vitest";
import { hashForMode, modeFromHash } from "../src/domain/navigation";

describe("app navigation", () => {
  it("maps every supported mode to a stable hash route", () => {
    expect(hashForMode("practice")).toBe("#/practice");
    expect(hashForMode("language")).toBe("#/language");
    expect(hashForMode("mock")).toBe("#/mock");
    expect(hashForMode("progress")).toBe("#/progress");
  });

  it("restores supported modes and falls back safely", () => {
    expect(modeFromHash("#/language")).toBe("language");
    expect(modeFromHash("#/progress")).toBe("progress");
    expect(modeFromHash("#/unknown")).toBe("practice");
    expect(modeFromHash("")).toBe("practice");
  });
});

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFetchUiLoader } from "../src/data/ui-loader";
import { createUiTranslator } from "../src/i18n/translator";
import type { UiManifest, UiMessages } from "../src/i18n/types";

const uiRoot = path.join(process.cwd(), "public", "data", "ui");

describe("UI localization", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("interpolates the selected locale and falls back to English", () => {
    const translate = createUiTranslator(
      { greeting: "مرحباً {{name}}" },
      { greeting: "Hello {{name}}", fallback: "Fallback" }
    );

    expect(translate("greeting", { name: "Kassem" })).toBe("مرحباً Kassem");
    expect(translate("fallback")).toBe("Fallback");
  });

  it("loads UI locale metadata and message packs independently", async () => {
    const responses = new Map<string, unknown>([
      ["/data/ui/manifest.json", {
        defaultLocale: "en",
        locales: [
          { id: "en", label: "English", direction: "ltr", messagesPath: "en.json" },
          { id: "ar", label: "العربية", direction: "rtl", messagesPath: "ar.json" }
        ]
      }],
      ["/data/ui/en.json", { settings: "Settings" }],
      ["/data/ui/ar.json", { settings: "الإعدادات" }]
    ]);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
      ok: responses.has(url),
      status: responses.has(url) ? 200 : 404,
      json: async () => responses.get(url)
    })));

    const bundle = await createFetchUiLoader().loadBundle();

    expect(bundle.manifest.defaultLocale).toBe("en");
    expect(bundle.messages.en.settings).toBe("Settings");
    expect(bundle.messages.ar.settings).toBe("الإعدادات");
  });

  it("ships complete English and Arabic packs with matching keys", () => {
    const manifest = readJson<UiManifest>(path.join(uiRoot, "manifest.json"));
    const english = readJson<UiMessages>(path.join(uiRoot, "en.json"));
    const arabic = readJson<UiMessages>(path.join(uiRoot, "ar.json"));

    expect(manifest.defaultLocale).toBe("en");
    expect(manifest.locales.map((locale) => locale.id)).toEqual(["en", "ar"]);
    expect(Object.keys(english).sort()).toEqual(Object.keys(arabic).sort());
    expect(Object.keys(english).length).toBeGreaterThan(80);
    expect(Object.values(arabic).every((value) => value.trim().length > 0)).toBe(true);
  });
});

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

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
        defaultLocale: "de",
        locales: [
          { id: "de", label: "Deutsch", direction: "ltr", messagesPath: "de.json" },
          { id: "en", label: "English", direction: "ltr", messagesPath: "en.json" },
          { id: "ru", label: "Русский", direction: "ltr", messagesPath: "ru.json" },
          { id: "ar", label: "العربية", direction: "rtl", messagesPath: "ar.json" }
        ]
      }],
      ["/data/ui/de.json", { settings: "Einstellungen" }],
      ["/data/ui/en.json", { settings: "Settings" }],
      ["/data/ui/ru.json", { settings: "Настройки" }],
      ["/data/ui/ar.json", { settings: "الإعدادات" }]
    ]);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
      ok: responses.has(url),
      status: responses.has(url) ? 200 : 404,
      json: async () => responses.get(url)
    })));

    const bundle = await createFetchUiLoader().loadBundle();

    expect(bundle.manifest.defaultLocale).toBe("de");
    expect(bundle.messages.de.settings).toBe("Einstellungen");
    expect(bundle.messages.en.settings).toBe("Settings");
    expect(bundle.messages.ru.settings).toBe("Настройки");
    expect(bundle.messages.ar.settings).toBe("الإعدادات");
  });

  it("ships complete German, English, Russian, and Arabic packs with matching keys", () => {
    const manifest = readJson<UiManifest>(path.join(uiRoot, "manifest.json"));
    const german = readJson<UiMessages>(path.join(uiRoot, "de.json"));
    const english = readJson<UiMessages>(path.join(uiRoot, "en.json"));
    const russian = readJson<UiMessages>(path.join(uiRoot, "ru.json"));
    const arabic = readJson<UiMessages>(path.join(uiRoot, "ar.json"));

    expect(manifest.defaultLocale).toBe("de");
    expect(manifest.locales.map((locale) => locale.id)).toEqual(["de", "en", "ru", "ar"]);
    expect(Object.keys(english).sort()).toEqual(Object.keys(german).sort());
    expect(Object.keys(english).sort()).toEqual(Object.keys(russian).sort());
    expect(Object.keys(english).sort()).toEqual(Object.keys(arabic).sort());
    expect(Object.keys(english).length).toBeGreaterThan(80);
    expect(Object.values(german).every((value) => value.trim().length > 0)).toBe(true);
    expect(Object.values(russian).every((value) => value.trim().length > 0)).toBe(true);
    expect(Object.values(arabic).every((value) => value.trim().length > 0)).toBe(true);
  });

  it("keeps both language choices explicit for learners", () => {
    const english = readJson<UiMessages>(path.join(uiRoot, "en.json"));

    expect(english["settings.interfaceLanguage"]).toBe("App language");
    expect(english["settings.supportLanguage"]).toBe("Question translation");
    expect(english["settings.title"]).toBe("More settings");
  });
});

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

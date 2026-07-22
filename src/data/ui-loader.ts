import type { UiBundle, UiManifest, UiMessages } from "../i18n/types";
import { fetchJson } from "./fetch-json";

const DEFAULT_UI_BASE_PATH = `${import.meta.env.BASE_URL}data/ui`;

export interface UiLoader {
  loadBundle(): Promise<UiBundle>;
}

export function createFetchUiLoader(basePath = DEFAULT_UI_BASE_PATH): UiLoader {
  return {
    async loadBundle() {
      const manifest = await fetchJson<UiManifest>(joinPath(basePath, "manifest.json"));
      const entries = await Promise.all(manifest.locales.map(async (locale) => [
        locale.id,
        await fetchJson<UiMessages>(joinPath(basePath, locale.messagesPath))
      ] as const));
      return { manifest, messages: Object.fromEntries(entries) };
    }
  };
}

function joinPath(basePath: string, path: string): string {
  return `${basePath.replace(/\/+$/u, "")}/${path.replace(/^\/+/u, "")}`;
}

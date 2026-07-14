import type { UiBundle, UiManifest, UiMessages } from "../i18n/types";

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

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}: ${response.status}`);
  return response.json() as Promise<T>;
}

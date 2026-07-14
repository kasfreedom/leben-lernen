import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const API_BASE_URL = "https://public-api.streamlinehq.com/v1";
const STREAMLINE_TOKEN_ENV = "STREAMLINE_TOKEN";
const FAMILY_SLUG = "ultimate-colos-free";
const FAMILY_NAME = "Ultimate Colors - Free";
const PRODUCT_TIER = "free";
const PRODUCT_TYPE = "icons";
const DOWNLOAD_SIZE = "64";
const ICON_DIR = "public/assets/visual-system/icons/streamline";
const MANIFEST_PATH = "public/assets/visual-system/manifest.json";

const ICONS = [
  { slot: "practice.book", file: "practice-book.svg", hash: "ico_4PUm1ZqAKpJIDlOU", name: "Book Book Pages", webUrl: "https://www.streamlinehq.com/icons/download/book-book-pages--31075" },
  { slot: "language.wordGlobe", file: "language-word-globe.svg", hash: "ico_1sMSaalJFC4Rz7yL", name: "Shield Globe", webUrl: "https://www.streamlinehq.com/icons/download/shield-globe--31081" },
  { slot: "mock.clipboard", file: "mock-clipboard.svg", hash: "ico_znEJac9A0M55X3fa", name: "Checklist", webUrl: "https://www.streamlinehq.com/icons/download/checklist--31084" },
  { slot: "progress.chart", file: "progress-chart.svg", hash: "ico_IRHjUYwL88oIKPED", name: "Analytics Graph Lines", webUrl: "https://www.streamlinehq.com/icons/download/analytics-graph-lines--31080" },
  { slot: "translation.speechGlobe", file: "translation-speech-globe.svg", hash: "ico_JINC2fp2GmBoKukc", name: "Question Help Message", webUrl: "https://www.streamlinehq.com/icons/download/question-help-message--31080" },
  { slot: "mock.timer", file: "mock-timer.svg", hash: "ico_OcuOSWBSSl13Duge", name: "Timer 10", webUrl: "https://www.streamlinehq.com/icons/download/timer-10--31073" },
  { slot: "support.tip", file: "support-tip.svg", hash: "ico_jMgcyy9O1CzEEhya", name: "Idea Strategy", webUrl: "https://www.streamlinehq.com/icons/download/idea-strategy--31079" },
  { slot: "result.passTrophy", file: "result-pass-trophy.svg", hash: "ico_kBrz0wK0F6mYq1GO", name: "Award Trophy 1", webUrl: "https://www.streamlinehq.com/icons/download/award-trophy-1--31066" },
  { slot: "review.warning", file: "review-warning.svg", hash: "ico_j3p6UmWTAo6PVDdP", name: "Network Warning", webUrl: "https://www.streamlinehq.com/icons/download/network-warning--31081" },
  { slot: "empty.notebook", file: "empty-notebook.svg", hash: "ico_Bb0BQImx4oqbUAib", name: "Notes Book", webUrl: "https://www.streamlinehq.com/icons/download/notes-book--31075" },
  { slot: "settings.gear", file: "settings-gear.svg", hash: "local-cog-download", name: "Cog", webUrl: "https://streamlinehq.com", manual: true },
  { slot: "bookmark", file: "bookmark.svg", hash: "ico_nLCyg8QsweLqpmHq", name: "Rating Star", webUrl: "https://www.streamlinehq.com/icons/download/rating-star--31066" }
];

const token = process.env[STREAMLINE_TOKEN_ENV];
if (!token) {
  throw new Error(`${STREAMLINE_TOKEN_ENV} is missing. Export it before running this script.`);
}

async function streamlineFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "x-api-key": token,
      ...options.headers
    }
  });

  if (!response.ok) {
    throw new Error(`Streamline API request failed: ${response.status} ${response.statusText} for ${url}`);
  }

  return response;
}

async function downloadSvg(hash) {
  const params = new URLSearchParams({
    responsive: "true",
    size: DOWNLOAD_SIZE
  });
  const response = await streamlineFetch(`${API_BASE_URL}/icons/${hash}/download/svg?${params.toString()}`, {
    headers: {
      Accept: "image/svg+xml"
    }
  });
  return response.text();
}

async function loadIconSvg(icon) {
  if (icon.manual) {
    return readFile(path.join(ICON_DIR, icon.file), "utf8");
  }
  return downloadSvg(icon.hash);
}

async function updateManifest(importedIcons) {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  manifest.assets = {
    ...manifest.assets,
    "icons.streamline": {
      family: FAMILY_NAME,
      familySlug: FAMILY_SLUG,
      license: "Free Streamline icons via Streamline API; attribution required by Streamline free license.",
      attribution: "Free icons from Streamline",
      source: "https://www.streamlinehq.com/icons/ultimate-colos-free/interface-essential",
      directory: "icons/streamline",
      importedAt: new Date().toISOString()
    }
  };
  manifest.icons = {
    ...manifest.icons,
    ...Object.fromEntries(importedIcons.map((icon) => [icon.slot, `icons/streamline/${icon.file}`]))
  };
  manifest.iconMetadata = {
    ...(manifest.iconMetadata ?? {}),
    streamline: Object.fromEntries(importedIcons.map((icon) => [
      icon.slot,
      {
        file: `icons/streamline/${icon.file}`,
        hash: icon.hash,
        name: icon.name,
        webUrl: icon.webUrl,
        familySlug: icon.familySlug,
        familyName: icon.familyName,
        isFree: icon.isFree,
        manual: icon.manual
      }
    ]))
  };
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
}

await mkdir(ICON_DIR, { recursive: true });

const importedIcons = [];
for (const icon of ICONS) {
  const svg = await loadIconSvg(icon);
  await writeFile(path.join(ICON_DIR, icon.file), svg);
  importedIcons.push({
    ...icon,
    familySlug: FAMILY_SLUG,
    familyName: FAMILY_NAME,
    isFree: true
  });
  console.log(`${icon.slot}: ${icon.name} (${icon.hash})`);
}

await updateManifest(importedIcons);
console.log(`Imported ${importedIcons.length} ${FAMILY_NAME} SVG icons.`);

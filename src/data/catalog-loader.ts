import type {
  ExamCatalog,
  LearningSupport,
  Region,
  SourceQuestion,
  SupportLocale
} from "../domain/types";
import { fetchJson } from "./fetch-json";

const DEFAULT_EXAM_BASE_PATH = `${import.meta.env.BASE_URL}data/exams/leben-in-deutschland`;
const GENERAL_REGION = "general";

export interface CatalogBundle {
  readonly catalog: ExamCatalog;
  readonly supportPacks: Readonly<Record<SupportLocale, readonly LearningSupport[]>>;
}

export interface CatalogLoader {
  loadBundle(): Promise<CatalogBundle>;
}

export function createFetchCatalogLoader(basePath = DEFAULT_EXAM_BASE_PATH): CatalogLoader {
  return {
    async loadBundle() {
      const manifest = await fetchJson<ExamCatalog>(joinPath(basePath, "manifest.json"));
      const generalQuestions = await fetchJson<readonly SourceQuestion[]>(
        joinPath(basePath, manifest.generalQuestionsPath ?? "questions.de.json")
      );
      const regionalQuestions = await Promise.all(
        manifest.regions.map(async (region) => fetchJson<readonly SourceQuestion[]>(
          joinPath(basePath, region.questionsPath ?? `regions/${region.id}.de.json`)
        ))
      );
      const supportEntries = await Promise.all(
        manifest.supportLocales.map(async (locale) => [
          locale.id,
          await fetchJson<readonly LearningSupport[]>(
            joinPath(basePath, locale.supportPath ?? `support/${locale.id}.json`)
          )
        ] as const)
      );

      return {
        catalog: {
          ...manifest,
          questions: [
            ...generalQuestions.map((question) => ({ ...question, region: GENERAL_REGION })),
            ...regionalQuestions.flat()
          ]
        },
        supportPacks: Object.fromEntries(supportEntries)
      };
    }
  };
}

export function getSupportPack(
  supportPacks: Readonly<Record<SupportLocale, readonly LearningSupport[]>>,
  locale: SupportLocale
): readonly LearningSupport[] {
  return supportPacks[locale] ?? [];
}

export function getAllSupportPacks(
  supportPacks: Readonly<Record<SupportLocale, readonly LearningSupport[]>>
): readonly LearningSupport[] {
  return Object.values(supportPacks).flat();
}

function joinPath(basePath: string, path: string): string {
  return `${basePath.replace(/\/+$/u, "")}/${path.replace(/^\/+/u, "")}`;
}

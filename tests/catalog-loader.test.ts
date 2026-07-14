import { afterEach, describe, expect, it, vi } from "vitest";
import { createFetchCatalogLoader } from "../src/data/catalog-loader";

describe("catalog loader", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads manifest, general questions, regional questions, and support packs from static JSON", async () => {
    const responses = new Map<string, unknown>([
      [
        "/data/exams/leben-in-deutschland/manifest.json",
        {
          id: "leben-in-deutschland",
          title: "Leben in Deutschland",
          sourceLocale: "de",
          defaultRegion: "bavaria",
          generalQuestionsPath: "questions.de.json",
          mockExam: {
            generalQuestionCount: 30,
            regionalQuestionCount: 3,
            passScore: 17,
            durationMinutes: 60
          },
          regions: [{ id: "bavaria", label: "Bavaria", questionsPath: "regions/bavaria.de.json" }],
          supportLocales: [{ id: "en", label: "English", supportPath: "support/en.json" }],
          questions: []
        }
      ],
      [
        "/data/exams/leben-in-deutschland/questions.de.json",
        [{ id: "general-1", sourceLocale: "de", region: "general", topic: "democracy", prompt: "Q", choices: [], correctChoiceId: "a" }]
      ],
      [
        "/data/exams/leben-in-deutschland/regions/bavaria.de.json",
        [{ id: "bavaria-1", sourceLocale: "de", region: "bavaria", topic: "regional", prompt: "R", choices: [], correctChoiceId: "a" }]
      ],
      [
        "/data/exams/leben-in-deutschland/support/en.json",
        [{ questionId: "general-1", locale: "en", translation: "T", correctAnswerTranslation: "A", simpleExplanation: "E", vocabulary: [] }]
      ]
    ]);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
      ok: responses.has(url),
      status: responses.has(url) ? 200 : 404,
      json: async () => responses.get(url)
    })));

    const bundle = await createFetchCatalogLoader().loadBundle();

    expect(bundle.catalog.questions.map((question) => question.id)).toEqual(["general-1", "bavaria-1"]);
    expect(bundle.supportPacks.en).toHaveLength(1);
  });
});

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createLanguageExercises, createMockExamQuestionIds } from "../src/domain/practice-engine";
import type { ExamCatalog, LearningSupport, SourceQuestion } from "../src/domain/types";

const dataRoot = path.join(process.cwd(), "public", "data", "exams", "leben-in-deutschland");
const manifest = readJson<Omit<ExamCatalog, "questions">>(path.join(dataRoot, "manifest.json"));
const generalQuestions = readJson<readonly SourceQuestion[]>(path.join(dataRoot, "questions.de.json"));
const bavariaQuestions = readJson<readonly SourceQuestion[]>(path.join(dataRoot, "regions", "bavaria.de.json"));
const germanQuestions = [...generalQuestions, ...bavariaQuestions];
const englishSupport = readJson<readonly LearningSupport[]>(path.join(dataRoot, "support", "en.json"));
const catalog: ExamCatalog = {
  ...manifest,
  questions: germanQuestions
};

describe("BAMF Bavaria catalog content", () => {
  it("contains the full Bavaria-relevant static JSON catalog", () => {
    expect(catalog.questions).toHaveLength(310);
    expect(catalog.questions.filter((question) => question.region === "general")).toHaveLength(300);
    expect(catalog.questions.filter((question) => question.region === "bavaria")).toHaveLength(10);
    expect(catalog.defaultRegion).toBe("bavaria");
    expect(catalog.regions.map((region) => region.id)).toEqual(["bavaria"]);
    expect(catalog.supportLocales.map((locale) => locale.id)).toEqual(["en"]);
  });

  it("has stable ids, four answer choices, and one correct choice per question", () => {
    const ids = new Set(germanQuestions.map((question) => question.id));

    expect(ids.size).toBe(310);
    for (const question of germanQuestions) {
      expect(question.choices).toHaveLength(4);
      expect(question.choices.map((choice) => choice.id)).toEqual(["a", "b", "c", "d"]);
      expect(question.choices.some((choice) => choice.id === question.correctChoiceId)).toBe(true);
      expect(question.prompt.length).toBeGreaterThan(0);
    }
  });

  it("creates a selected-region mock exam with 30 general and 3 regional questions", () => {
    const mockIds = createMockExamQuestionIds(catalog, {
      region: "bavaria",
      seed: 13
    });
    const mockQuestions = mockIds.map((id) => {
      const question = germanQuestions.find((candidate) => candidate.id === id);
      if (!question) throw new Error(`Missing question: ${id}`);
      return question;
    });

    expect(mockIds).toHaveLength(33);
    expect(mockQuestions.filter((question) => question.region === "general")).toHaveLength(30);
    expect(mockQuestions.filter((question) => question.region === "bavaria")).toHaveLength(3);
  });

  it("has English study support JSON for every catalog question", () => {
    const ids = new Set(germanQuestions.map((question) => question.id));
    const supportIds = new Set(englishSupport.map((support) => support.questionId));

    expect(englishSupport).toHaveLength(310);
    expect(supportIds.size).toBe(310);
    for (const support of englishSupport) {
      expect(ids.has(support.questionId)).toBe(true);
      expect(support.locale).toBe("en");
      expect(support.translation.length).toBeGreaterThan(0);
      expect(support.correctAnswerTranslation.length).toBeGreaterThan(0);
      expect(support.simpleExplanation.length).toBeGreaterThan(0);
      expect(support.vocabulary.length).toBeGreaterThan(0);
    }
  });

  it("creates full-catalog language practice drills from support JSON", () => {
    const exercises = createLanguageExercises(englishSupport);
    const questionIdsWithDrills = new Set(exercises.map((exercise) => exercise.questionId));

    expect(exercises.length).toBeGreaterThan(700);
    expect(questionIdsWithDrills.size).toBe(310);
  });
});

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

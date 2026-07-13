import { describe, expect, it } from "vitest";
import {
  createLanguageExercises,
  createMockExamQuestionIds,
  createEmptyProgressSnapshot,
  createPracticeEngine,
  createPracticeSession,
  getAvailableSupportLocales,
  getCatalogQuestionIds,
  getPracticeSetQuestionIds,
  getRegionalQuestions,
  hydratePracticeSession,
  moveToNextQuestion,
  recordSessionAnswer,
  toggleBookmark
} from "../src/domain/practice-engine";
import type { ExamCatalog, LearningSupport, SourceQuestion } from "../src/domain/types";

const question: SourceQuestion = {
  id: "general-1",
  sourceLocale: "de",
  region: "general",
  topic: "democracy",
  prompt: "Wie heißt die deutsche Verfassung?",
  choices: [
    { id: "a", text: "Volksgesetz" },
    { id: "b", text: "Bundesgesetz" },
    { id: "c", text: "Deutsches Gesetz" },
    { id: "d", text: "Grundgesetz" }
  ],
  correctChoiceId: "d"
};

const support: LearningSupport = {
  questionId: "general-1",
  locale: "en",
  translation: "What is the German constitution called?",
  correctAnswerTranslation: "Basic Law",
  simpleExplanation: "Germany's constitution is called the Basic Law.",
  vocabulary: [{ source: "die Verfassung", translation: "the constitution" }]
};

const catalog: ExamCatalog = {
  id: "leben-in-deutschland",
  title: "Leben in Deutschland",
  sourceLocale: "de",
  defaultRegion: "bavaria",
  mockExam: {
    generalQuestionCount: 1,
    regionalQuestionCount: 1,
    passScore: 1,
    durationMinutes: 60
  },
  regions: [
    { id: "bavaria", label: "Bavaria" },
    { id: "berlin", label: "Berlin" }
  ],
  supportLocales: [{ id: "en", label: "English" }],
  questions: [
    question,
    {
      ...question,
      id: "bavaria-1",
      region: "bavaria",
      topic: "regional",
      prompt: "Wie heißt die Landeshauptstadt von Bayern?"
    },
    {
      ...question,
      id: "berlin-1",
      region: "berlin",
      topic: "regional",
      prompt: "Wie heißt die Hauptstadt von Berlin?"
    }
  ]
};

describe("practice engine", () => {
  it("joins source questions with an independent language pack", () => {
    const engine = createPracticeEngine([question], [support]);

    expect(engine.getLearningItem("general-1", "en")).toEqual({ question, support });
  });

  it("scores answers by stable choice id rather than translated text", () => {
    const engine = createPracticeEngine([question], [support]);

    expect(engine.checkAnswer("general-1", "a", { usedSupport: false }).isCorrect).toBe(false);
    expect(engine.checkAnswer("general-1", "d", { usedSupport: true })).toMatchObject({
      isCorrect: true,
      usedSupport: true
    });
  });

  it("continues to expose the German question when support is unavailable", () => {
    const engine = createPracticeEngine([question], []);

    expect(engine.getLearningItem("general-1", "en")).toEqual({
      question,
      support: undefined
    });
  });

  it("tracks score, assisted answers, German-only correct answers, and difficult questions", () => {
    const session = createPracticeSession(["general-1"]);
    const answered = recordSessionAnswer(session, {
      question,
      selectedChoiceId: "a",
      usedSupport: true,
      answeredAt: "2026-07-13T10:00:00.000Z"
    });

    expect(answered.summary).toEqual({
      totalQuestions: 1,
      answered: 1,
      correct: 0,
      incorrect: 1,
      assisted: 1,
      germanOnlyCorrect: 0,
      percentCorrect: 0,
      isComplete: true,
      currentStreak: 0,
      difficultQuestionIds: ["general-1"]
    });
  });

  it("records an answer without changing the visible question", () => {
    const session = createPracticeSession(["general-1"]);
    const answered = recordSessionAnswer(session, {
      question,
      selectedChoiceId: "d",
      usedSupport: false,
      answeredAt: "2026-07-13T10:00:00.000Z"
    });

    expect(answered.currentIndex).toBe(0);
    expect(answered.summary.isComplete).toBe(true);
    expect(answered.summary.germanOnlyCorrect).toBe(1);
  });

  it("moves forward without wrapping after the final question", () => {
    const session = createPracticeSession(["general-1"]);

    expect(moveToNextQuestion(session).currentIndex).toBe(0);
  });

  it("hydrates saved answers into a new session summary", () => {
    const session = hydratePracticeSession(["general-1"], [
      {
        questionId: "general-1",
        selectedChoiceId: "d",
        correctChoiceId: "d",
        isCorrect: true,
        usedSupport: false,
        answeredAt: "2026-07-13T10:00:00.000Z"
      }
    ]);

    expect(session.summary).toMatchObject({
      answered: 1,
      correct: 1,
      germanOnlyCorrect: 1,
      isComplete: true
    });
  });

  it("creates vocabulary and pattern exercises from language support content", () => {
    const exercises = createLanguageExercises([support]);

    expect(exercises).toEqual([
      {
        id: "general-1:vocabulary:0",
        type: "vocabulary",
        questionId: "general-1",
        prompt: "die Verfassung",
        answer: "the constitution",
        hint: "What does this German phrase mean?"
      }
    ]);
  });

  it("exposes available regions and support languages from catalog metadata", () => {
    expect(catalog.regions.map((region) => region.id)).toEqual(["bavaria", "berlin"]);
    expect(getAvailableSupportLocales(catalog)).toEqual(["en"]);
  });

  it("builds a regional question set without knowing Bavaria specifically", () => {
    expect(getCatalogQuestionIds(catalog, { region: "berlin" })).toEqual(["general-1", "berlin-1"]);
    expect(getRegionalQuestions(catalog, "bavaria").map((item) => item.id)).toEqual(["bavaria-1"]);
  });

  it("creates a mock exam for the selected region instead of a hardcoded state", () => {
    const mockIds = createMockExamQuestionIds(catalog, { region: "berlin", seed: 13 });

    expect(mockIds).toHaveLength(2);
    expect(mockIds).toContain("general-1");
    expect(mockIds).toContain("berlin-1");
  });

  it("filters practice sets by unseen, wrong, bookmarked, and selected region", () => {
    const progress = {
      ...createEmptyProgressSnapshot("2026-07-13T10:00:00.000Z"),
      answers: [
        {
          questionId: "general-1",
          selectedChoiceId: "a",
          correctChoiceId: "d",
          isCorrect: false,
          usedSupport: false,
          answeredAt: "2026-07-13T10:00:00.000Z"
        }
      ],
      bookmarkedQuestionIds: ["berlin-1"]
    };

    expect(getPracticeSetQuestionIds(catalog, { region: "berlin", practiceSet: "all", progress })).toEqual([
      "general-1",
      "berlin-1"
    ]);
    expect(getPracticeSetQuestionIds(catalog, { region: "berlin", practiceSet: "unseen", progress })).toEqual([
      "berlin-1"
    ]);
    expect(getPracticeSetQuestionIds(catalog, { region: "berlin", practiceSet: "wrong", progress })).toEqual([
      "general-1"
    ]);
    expect(getPracticeSetQuestionIds(catalog, { region: "berlin", practiceSet: "bookmarked", progress })).toEqual([
      "berlin-1"
    ]);
    expect(getPracticeSetQuestionIds(catalog, { region: "berlin", practiceSet: "region", progress })).toEqual([
      "berlin-1"
    ]);
  });

  it("toggles bookmarks in progress", () => {
    const progress = createEmptyProgressSnapshot("2026-07-13T10:00:00.000Z");
    const bookmarked = toggleBookmark(progress, "general-1", "2026-07-13T10:01:00.000Z");
    const unbookmarked = toggleBookmark(bookmarked, "general-1", "2026-07-13T10:02:00.000Z");

    expect(bookmarked.bookmarkedQuestionIds).toEqual(["general-1"]);
    expect(unbookmarked.bookmarkedQuestionIds).toEqual([]);
  });
});

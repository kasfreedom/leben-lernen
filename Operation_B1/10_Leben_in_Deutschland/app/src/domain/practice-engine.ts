import type {
  AnswerResult,
  ChoiceId,
  ExamCatalog,
  LanguageExercise,
  LearningSupport,
  PracticeSession,
  QuestionId,
  SessionAnswer,
  SessionSummary,
  SourceQuestion,
  SupportLocale
} from "./types";

const PERFECT_SCORE = 100;
const NO_SCORE = 0;
const FIRST_INDEX = 0;
const SESSION_VERSION = 1;
const GENERAL_REGION = "general";

export interface PracticeEngine {
  getLearningItem(
    questionId: QuestionId,
    locale: SupportLocale
  ): { question: SourceQuestion; support: LearningSupport | undefined };
  checkAnswer(
    questionId: QuestionId,
    choiceId: ChoiceId,
    options?: { readonly usedSupport?: boolean }
  ): AnswerResult;
}

export function createPracticeEngine(
  questions: readonly SourceQuestion[],
  languagePack: readonly LearningSupport[]
): PracticeEngine {
  const questionsById = new Map(questions.map((question) => [question.id, question]));
  const supportByKey = new Map(
    languagePack.map((support) => [`${support.questionId}:${support.locale}`, support])
  );

  function getQuestion(questionId: QuestionId): SourceQuestion {
    const question = questionsById.get(questionId);
    if (!question) throw new Error(`Unknown question: ${questionId}`);
    return question;
  }

  return {
    getLearningItem(questionId, locale) {
      return {
        question: getQuestion(questionId),
        support: supportByKey.get(`${questionId}:${locale}`)
      };
    },
    checkAnswer(questionId, selectedChoiceId, options = {}) {
      const question = getQuestion(questionId);
      return {
        questionId,
        selectedChoiceId,
        correctChoiceId: question.correctChoiceId,
        isCorrect: selectedChoiceId === question.correctChoiceId,
        usedSupport: options.usedSupport ?? false
      };
    }
  };
}

export function createPracticeSession(questionIds: readonly QuestionId[]): PracticeSession {
  return buildSession(questionIds, FIRST_INDEX, []);
}

export function hydratePracticeSession(
  questionIds: readonly QuestionId[],
  answers: readonly SessionAnswer[]
): PracticeSession {
  const allowedQuestionIds = new Set(questionIds);
  const currentAnswers = answers.filter((answer) => allowedQuestionIds.has(answer.questionId));
  const currentIndex = Math.min(currentAnswers.length, Math.max(questionIds.length - 1, FIRST_INDEX));
  return buildSession(questionIds, currentIndex, currentAnswers);
}

export function recordSessionAnswer(
  session: PracticeSession,
  input: {
    readonly question: SourceQuestion;
    readonly selectedChoiceId: ChoiceId;
    readonly usedSupport: boolean;
    readonly answeredAt: string;
  }
): PracticeSession {
  const answer: SessionAnswer = {
    questionId: input.question.id,
    selectedChoiceId: input.selectedChoiceId,
    correctChoiceId: input.question.correctChoiceId,
    isCorrect: input.selectedChoiceId === input.question.correctChoiceId,
    usedSupport: input.usedSupport,
    answeredAt: input.answeredAt
  };
  const answers = [
    ...session.answers.filter((existing) => existing.questionId !== input.question.id),
    answer
  ];
  return buildSession(session.questionIds, session.currentIndex, answers);
}

export function moveToNextQuestion(session: PracticeSession): PracticeSession {
  const nextIndex = Math.min(
    session.currentIndex + 1,
    Math.max(session.questionIds.length - 1, FIRST_INDEX)
  );
  return buildSession(session.questionIds, nextIndex, session.answers);
}

export function createLanguageExercises(languagePack: readonly LearningSupport[]): readonly LanguageExercise[] {
  return languagePack.flatMap((support) => {
    const vocabulary = support.vocabulary.map((item, index): LanguageExercise => ({
      id: `${support.questionId}:vocabulary:${index}`,
      type: "vocabulary",
      questionId: support.questionId,
      prompt: item.source,
      answer: item.translation,
      hint: "What does this German phrase mean?"
    }));

    if (!support.germanPattern) return vocabulary;

    return [
      ...vocabulary,
      {
        id: `${support.questionId}:pattern:0`,
        type: "pattern",
        questionId: support.questionId,
        prompt: support.germanPattern.pattern,
        answer: support.germanPattern.meaning,
        hint: "What does this German structure mean?"
      }
    ];
  });
}

export function createEmptyProgressSnapshot(updatedAt: string) {
  return {
    version: SESSION_VERSION,
    updatedAt,
    answers: [],
    vocabularyMastery: {}
  } as const;
}

export function getAvailableSupportLocales(catalog: ExamCatalog): readonly SupportLocale[] {
  return catalog.supportLocales.map((locale) => locale.id);
}

export function getRegionalQuestions(catalog: ExamCatalog, region: string): readonly SourceQuestion[] {
  return catalog.questions.filter((question) => question.region === region);
}

export function getCatalogQuestionIds(
  catalog: ExamCatalog,
  options: { readonly region: string }
): readonly QuestionId[] {
  return catalog.questions
    .filter((question) => question.region === GENERAL_REGION || question.region === options.region)
    .map((question) => question.id);
}

export function createMockExamQuestionIds(
  catalog: ExamCatalog,
  options: { readonly region: string; readonly seed: number }
): readonly QuestionId[] {
  const general = catalog.questions.filter((question) => question.region === GENERAL_REGION);
  const regional = getRegionalQuestions(catalog, options.region);
  const { generalQuestionCount, regionalQuestionCount } = catalog.mockExam;
  if (general.length < generalQuestionCount || regional.length < regionalQuestionCount) {
    throw new Error(`Not enough questions to create a mock exam for region: ${options.region}`);
  }

  return [
    ...takeShuffled(general, generalQuestionCount, options.seed),
    ...takeShuffled(regional, regionalQuestionCount, options.seed + 1)
  ].map((question) => question.id);
}

function buildSession(
  questionIds: readonly QuestionId[],
  currentIndex: number,
  answers: readonly SessionAnswer[]
): PracticeSession {
  return {
    questionIds,
    currentIndex,
    answers,
    summary: summarizeSession(questionIds.length, answers)
  };
}

function summarizeSession(totalQuestions: number, answers: readonly SessionAnswer[]): SessionSummary {
  const correct = answers.filter((answer) => answer.isCorrect).length;
  const answered = answers.length;
  const assisted = answers.filter((answer) => answer.usedSupport).length;
  const germanOnlyCorrect = answers.filter((answer) => answer.isCorrect && !answer.usedSupport).length;
  return {
    totalQuestions,
    answered,
    correct,
    incorrect: answered - correct,
    assisted,
    germanOnlyCorrect,
    percentCorrect: answered === 0 ? NO_SCORE : Math.round((correct / answered) * PERFECT_SCORE),
    isComplete: answered >= totalQuestions,
    currentStreak: countCurrentStreak(answers),
    difficultQuestionIds: answers
      .filter((answer) => !answer.isCorrect || answer.usedSupport)
      .map((answer) => answer.questionId)
  };
}

function countCurrentStreak(answers: readonly SessionAnswer[]): number {
  let streak = 0;
  for (let index = answers.length - 1; index >= 0; index -= 1) {
    if (!answers[index]?.isCorrect) break;
    streak += 1;
  }
  return streak;
}

function takeShuffled(
  questions: readonly SourceQuestion[],
  count: number,
  seed: number
): readonly SourceQuestion[] {
  const copy = [...questions];
  let state = seed || 1;
  for (let index = copy.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const swapIndex = state % (index + 1);
    const current = copy[index];
    const swap = copy[swapIndex];
    if (!current || !swap) throw new Error("Shuffle index out of range");
    copy[index] = swap;
    copy[swapIndex] = current;
  }
  return copy.slice(0, count);
}

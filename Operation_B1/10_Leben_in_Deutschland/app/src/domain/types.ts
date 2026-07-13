export type QuestionId = string;
export type ChoiceId = "a" | "b" | "c" | "d";
export type Region = string;
export type SupportLocale = string;
export type PracticeMode = "learn" | "practice" | "language" | "mock";
export type PracticeSet = "all" | "unseen" | "wrong" | "bookmarked" | "region";
export type LanguageExerciseType = "vocabulary" | "pattern";
export type SourceLocale = "de";
export type Topic = "democracy" | "history" | "society" | "regional" | string;

export interface RegionOption {
  readonly id: Region;
  readonly label: string;
  readonly questionsPath?: string;
}

export interface SupportLocaleOption {
  readonly id: SupportLocale;
  readonly label: string;
  readonly supportPath?: string;
}

export interface MockExamRules {
  readonly generalQuestionCount: number;
  readonly regionalQuestionCount: number;
  readonly passScore: number;
  readonly durationMinutes: number;
}

export interface ExamCatalog {
  readonly id: string;
  readonly title: string;
  readonly sourceLocale: SourceLocale;
  readonly defaultRegion: Region;
  readonly generalQuestionsPath?: string;
  readonly mockExam: MockExamRules;
  readonly regions: readonly RegionOption[];
  readonly supportLocales: readonly SupportLocaleOption[];
  readonly questions: readonly SourceQuestion[];
}

export interface Choice {
  readonly id: ChoiceId;
  readonly text: string;
}

export interface SourceQuestion {
  readonly id: QuestionId;
  readonly sourceLocale: SourceLocale;
  readonly region: Region;
  readonly topic: Topic;
  readonly prompt: string;
  readonly choices: readonly Choice[];
  readonly correctChoiceId: ChoiceId;
  readonly image?: string;
}

export interface VocabularyItem {
  readonly source: string;
  readonly translation: string;
}

export interface LearningSupport {
  readonly questionId: QuestionId;
  readonly locale: SupportLocale;
  readonly translation: string;
  readonly correctAnswerTranslation: string;
  readonly simpleExplanation: string;
  readonly vocabulary: readonly VocabularyItem[];
  readonly germanPattern?: {
    readonly pattern: string;
    readonly meaning: string;
  };
}

export interface AnswerResult {
  readonly questionId: QuestionId;
  readonly selectedChoiceId: ChoiceId;
  readonly correctChoiceId: ChoiceId;
  readonly isCorrect: boolean;
  readonly usedSupport: boolean;
}

export interface SessionAnswer {
  readonly questionId: QuestionId;
  readonly selectedChoiceId: ChoiceId;
  readonly correctChoiceId: ChoiceId;
  readonly isCorrect: boolean;
  readonly usedSupport: boolean;
  readonly answeredAt: string;
}

export interface SessionSummary {
  readonly totalQuestions: number;
  readonly answered: number;
  readonly correct: number;
  readonly incorrect: number;
  readonly assisted: number;
  readonly germanOnlyCorrect: number;
  readonly percentCorrect: number;
  readonly isComplete: boolean;
  readonly currentStreak: number;
  readonly difficultQuestionIds: readonly QuestionId[];
}

export interface PracticeSession {
  readonly questionIds: readonly QuestionId[];
  readonly currentIndex: number;
  readonly answers: readonly SessionAnswer[];
  readonly summary: SessionSummary;
}

export interface MockExamResult {
  readonly totalQuestions: number;
  readonly answered: number;
  readonly correct: number;
  readonly incorrect: number;
  readonly unanswered: number;
  readonly passScore: number;
  readonly passed: boolean;
  readonly wrongQuestionIds: readonly QuestionId[];
}

export interface ProgressSnapshot {
  readonly version: 1;
  readonly updatedAt: string;
  readonly answers: readonly SessionAnswer[];
  readonly bookmarkedQuestionIds: readonly QuestionId[];
  readonly vocabularyMastery: Readonly<Record<string, number>>;
}

export interface LanguageExercise {
  readonly id: string;
  readonly type: LanguageExerciseType;
  readonly questionId: QuestionId;
  readonly prompt: string;
  readonly answer: string;
  readonly hint?: string;
}

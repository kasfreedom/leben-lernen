import "./styles.css";
import {
  createFetchCatalogLoader,
  getAllSupportPacks,
  getSupportPack
} from "./data/catalog-loader";
import { createFetchUiLoader } from "./data/ui-loader";
import { createUiTranslator } from "./i18n/translator";
import {
  createLanguageExercises,
  createMockExamQuestionIds,
  createPracticeEngine,
  createPracticeSession,
  getPracticeSetQuestionIds,
  getMockQuestionStatuses,
  hydratePracticeSession,
  moveToNextQuestion,
  recordMockExamAttempt,
  recordSessionAnswer,
  summarizeMockExam,
  summarizeProgress,
  summarizeWeakTopics,
  toggleBookmark,
  updateVocabularyMastery
} from "./domain/practice-engine";
import { hasPromptTranslation } from "./domain/support-quality";
import { hashForMode, modeFromHash } from "./domain/navigation";
import type { PracticeEngine } from "./domain/practice-engine";
import type { UiManifest, UiMessages, UiTranslate } from "./i18n/types";
import type {
  ChoiceId,
  ExamCatalog,
  LanguageExercise,
  LearningSupport,
  MockExamAttempt,
  MockExamResult,
  MockExamWrongAnswer,
  PracticeMode,
  PracticeSet,
  PracticeSession,
  ProgressSnapshot,
  QuestionId,
  SourceQuestion,
  WeakTopicSummary
} from "./domain/types";

const PROGRESS_STORAGE_KEY = "leben-lernen-progress-v1";
const UI_LOCALE_STORAGE_KEY = "leben-lernen-ui-locale-v1";
const MAX_MASTERY = 100;
const MIN_MASTERY = 0;
const PUBLIC_BASE_URL = import.meta.env.BASE_URL;
const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_SECOND = 1_000;
const MOCK_TIMER_SELECTOR = "[data-mock-timer]";
const RTL_SUPPORT_LOCALES = new Set(["ar"]);

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("App root is missing");
const app: HTMLDivElement = root;
app.innerHTML = `<main class="loading-state"><p>Loading practice data…</p></main>`;

let catalog: ExamCatalog;
let engine: PracticeEngine;
let supportPacks: Readonly<Record<string, readonly LearningSupport[]>>;
let uiManifest: UiManifest;
let uiMessages: Readonly<Record<string, UiMessages>>;
let selectedUiLocale = "en";
let t: UiTranslate = (key) => key;
let progress: ProgressSnapshot;
let mode: PracticeMode = modeFromHash(window.location.hash);
let selectedRegion = "";
let selectedSupportLocale = "";
let selectedPracticeSet: PracticeSet = "all";
let practiceSession: PracticeSession;
let mockSession: PracticeSession | undefined;
let mockDeadlineAt = 0;
let mockTimerId: number | undefined;
let mockStartedAt = "";
let mockAttemptSaved = false;
let mockReviewing = false;
let mockSubmitted = false;
let customPracticeLabel: string | undefined;
let selected: ChoiceId | undefined;
let checked = false;
let showSupport = true;
let usedSupportForQuestion = showSupport;
let languageIndex = 0;
let languageRevealed = false;

function currentQuestion(): SourceQuestion {
  const session = activeSession();
  const questionId = session.questionIds[session.currentIndex];
  if (!questionId) throw new Error("Question index is out of range");
  return engine.getLearningItem(questionId, selectedSupportLocale).question;
}

function activeSession(): PracticeSession {
  if (mode !== "mock") return practiceSession;
  if (!mockSession) throw new Error("Mock exam has not started");
  return mockSession;
}

function setActiveSession(nextSession: PracticeSession): void {
  if (mode === "mock") {
    mockSession = nextSession;
  } else {
    practiceSession = nextSession;
  }
}

function render(options: { readonly resetView?: boolean } = {}): void {
  updateMockTimer();

  if (mode === "progress") {
    renderProgress();
  } else if (mode === "language") {
    renderLanguagePractice();
  } else if (mode === "mock" && !mockSession) {
    renderMockStart();
  } else if (mode === "practice" && activeSession().questionIds.length === 0) {
    renderEmptyPracticeSet();
  } else if (mode === "mock" && (mockSubmitted || activeSession().summary.isComplete || isMockExpired())) {
    renderMockResult();
  } else if (mode === "mock" && mockReviewing) {
    renderMockReview();
  } else if (activeSession().summary.isComplete) {
    renderCompletion();
  } else {
    renderQuestion();
  }

  if (options.resetView) resetScreenPosition();
}

function renderQuestion(): void {
  const question = currentQuestion();
  const session = activeSession();
  const { support } = engine.getLearningItem(question.id, selectedSupportLocale);
  const isMockExam = mode === "mock";
  const result = !isMockExam && selected && checked
    ? engine.checkAnswer(question.id, selected, { usedSupport: usedSupportForQuestion })
    : undefined;
  const progressPercent = Math.round((session.summary.answered / session.summary.totalQuestions) * MAX_MASTERY);
  const primaryLabel = isMockExam
    ? session.currentIndex === session.questionIds.length - 1 ? t("mock.reviewFinish") : t("practice.nextQuestion")
    : checked ? session.summary.isComplete ? t("practice.seeResults") : t("practice.nextQuestion") : t("practice.checkAnswer");

  app.innerHTML = layout(`
    <section class="question-area">
      ${mode === "practice" ? renderPracticeToolbar(session) : ""}
      ${isMockExam ? renderMockHeader(session) : ""}
      ${isMockExam ? renderMockQuestionNavigator(session) : ""}
      <div class="score-strip session-score" aria-label="${escapeHtml(t("score.score"))}">
        ${metric(t("score.score"), `${session.summary.percentCorrect}%`)}
        ${metric(t("score.correct"), `${session.summary.correct}/${session.summary.answered}`)}
        ${metric(t("score.germanOnly"), `${session.summary.germanOnlyCorrect}`)}
        ${metric(t("score.assisted"), `${session.summary.assisted}`)}
      </div>
      <div class="mobile-session-summary" aria-label="${escapeHtml(t("mock.progress"))}"><strong>${session.summary.percentCorrect}%</strong><span>${session.summary.correct}/${session.summary.answered} ${escapeHtml(t("common.correct").toLocaleLowerCase(selectedUiLocale))}</span><span>${session.summary.answered}/${session.summary.totalQuestions} ${escapeHtml(t("score.answered").toLocaleLowerCase(selectedUiLocale))}</span></div>
      <div class="question-meta"><span>${escapeHtml(t("practice.question", { current: session.currentIndex + 1 }))}</span>${isMockExam ? `<span>${escapeHtml(t("practice.noHints"))}</span>` : `<div class="question-tools"><button class="bookmark-button ${isCurrentQuestionBookmarked() ? "active" : ""}" id="bookmark" aria-pressed="${isCurrentQuestionBookmarked()}">${isCurrentQuestionBookmarked() ? `★ ${escapeHtml(t("practice.bookmarked"))}` : `☆ ${escapeHtml(t("practice.bookmark"))}`}</button></div>`}</div>
      <h1 lang="de" dir="ltr" data-screen-heading tabindex="-1">${escapeHtml(question.prompt)}</h1>
      ${!isMockExam ? `<label class="toggle translation-toggle"><span>${escapeHtml(t("practice.showTranslation"))}</span><input type="checkbox" ${showSupport ? "checked" : ""}><i></i></label>` : ""}
      ${!isMockExam && showSupport ? renderPromptTranslation(support) : ""}
      ${!isMockExam && showSupport ? renderMobileStudyPreview(support) : ""}
      ${question.image ? `<figure class="catalog-figure"><img src="${escapeHtml(publicAssetPath(`catalog-pages/${question.image}.png`))}" alt="Official BAMF catalog visual for ${escapeHtml(question.id)}"></figure>` : ""}
      <fieldset><legend class="sr-only">${escapeHtml(t("practice.chooseAnswer"))}</legend>${question.choices.map((choice) => {
        const isSelected = selected === choice.id;
        const state = checked ? choice.id === question.correctChoiceId ? " correct" : isSelected ? " wrong" : "" : "";
        return `<label class="answer${isSelected ? " selected" : ""}${state}"><input type="radio" name="answer" value="${choice.id}" ${isSelected ? "checked" : ""}><span class="radio"></span><span lang="de" dir="ltr">${escapeHtml(choice.text)}</span></label>`;
      }).join("")}</fieldset>
      ${result ? `<div class="feedback ${result.isCorrect ? "success" : "error"}" role="status"><strong>${escapeHtml(result.isCorrect ? t("common.correct") : t("practice.notQuite"))}</strong>${support ? `<span ${supportTextAttributes()}>${escapeHtml(t("practice.translatedAnswer", { answer: support.correctAnswerTranslation }))}</span>` : ""}<span ${supportTextAttributes()}>${escapeHtml(support?.simpleExplanation ?? t("practice.reviewCorrect"))}</span></div>` : ""}
      <div class="actions"><button class="secondary" id="previous" ${session.currentIndex === 0 ? "disabled" : ""}>${escapeHtml(t("common.previous"))}</button><button class="primary" id="check" ${selected ? "" : "disabled"}>${escapeHtml(primaryLabel)}</button></div>
      <div class="progress-note"><span class="progress-track"><i style="width:${progressPercent}%"></i></span><span>${escapeHtml(t("practice.answeredInSet", { count: session.summary.answered }))}</span></div>
    </section>
    ${isMockExam ? renderMockPanel(session) : renderSupportPanel(question.id)}
  `);

  bindShell();
  bindQuestion();
}

function renderEmptyPracticeSet(): void {
  app.innerHTML = layout(`
    <section class="question-area completion">
      ${renderPracticeToolbar(activeSession())}
      <p class="completion-label">${escapeHtml(t("empty.noQuestions"))}</p>
      <h1 data-screen-heading tabindex="-1">${escapeHtml(t("empty.nothingReview"))}</h1>
      <p class="inline-translation">${escapeHtml(t("empty.help"))}</p>
    </section>
    <aside class="support"><section><h2>${escapeHtml(t("empty.practiceSets"))}</h2><p>${escapeHtml(t("empty.savedProgress"))}</p></section></aside>
  `);

  bindShell();
}

function renderCompletion(): void {
  const session = activeSession();
  const completionLabel = mode === "mock" ? t("mock.result") : t("completion.practice");
  app.innerHTML = layout(`
    <section class="question-area completion">
      <p class="completion-label">${completionLabel}</p>
      <h1 data-screen-heading tabindex="-1">${escapeHtml(t("completion.score", { score: session.summary.percentCorrect }))}</h1>
      <p class="inline-translation">${escapeHtml(t("completion.summary", { correct: session.summary.correct, total: session.summary.totalQuestions, assisted: session.summary.assisted }))}</p>
      <div class="score-strip large">
        ${metric(t("score.correct"), String(session.summary.correct))}
        ${metric(t("score.germanOnly"), String(session.summary.germanOnlyCorrect))}
        ${metric(t("score.needsReview"), String(session.summary.difficultQuestionIds.length))}
        ${metric(t("score.streak"), String(session.summary.currentStreak))}
      </div>
      <div class="review-list">
        <h2>${escapeHtml(t("completion.reviewNext"))}</h2>
        ${session.summary.difficultQuestionIds.length > 0
          ? `<ul>${session.summary.difficultQuestionIds.map((id) => `<li>${escapeHtml(id)}</li>`).join("")}</ul>`
          : `<p>${escapeHtml(t("completion.noDifficult"))}</p>`}
      </div>
      <div class="actions"><button class="secondary" id="reset-progress">${escapeHtml(t("completion.reset"))}</button><button class="primary" id="restart">${escapeHtml(t("completion.startAgain"))}</button></div>
    </section>
    <aside class="support"><section><h2>${escapeHtml(t("completion.nextFocus"))}</h2><p>${escapeHtml(t("completion.languageHint"))}</p></section></aside>
  `);

  bindShell();
  app.querySelector<HTMLButtonElement>("#restart")?.addEventListener("click", () => {
    if (mode === "mock") {
        mockSession = createPracticeSession(createMockExamQuestionIds(catalog, {
          region: selectedRegion,
          seed: Date.now()
        }));
      } else {
        resetPracticeSession();
      }
    selected = undefined;
    checked = false;
    usedSupportForQuestion = showSupport;
    render();
  });
  app.querySelector<HTMLButtonElement>("#reset-progress")?.addEventListener("click", () => {
    progress = createProgressSnapshot();
    saveProgress(progress);
    resetPracticeSession();
    selected = undefined;
    checked = false;
    usedSupportForQuestion = showSupport;
    render();
  });
}

function renderMockStart(): void {
  const totalQuestions = catalog.mockExam.generalQuestionCount + catalog.mockExam.regionalQuestionCount;
  app.innerHTML = layout(`
    <section class="question-area mock-start">
      <p class="completion-label">${escapeHtml(t("mock.title"))}</p>
      <h1 data-screen-heading tabindex="-1">${escapeHtml(t("mock.readyTitle"))}</h1>
      <p class="lead-copy">${escapeHtml(t("mock.readyCopy"))}</p>
      <div class="exam-facts" aria-label="${escapeHtml(t("mock.title"))}">
        ${metric(t("score.questions"), String(totalQuestions))}
        ${metric(t("score.time"), `${catalog.mockExam.durationMinutes} min`)}
        ${metric(t("score.passMark"), `${catalog.mockExam.passScore}/${totalQuestions}`)}
      </div>
      <div class="exam-checklist">
        <h2>${escapeHtml(t("mock.beforeStart"))}</h2>
        <ul>
          <li>${escapeHtml(t("mock.instruction1"))}</li>
          <li>${escapeHtml(t("mock.instruction2"))}</li>
          <li>${escapeHtml(t("mock.instruction3"))}</li>
        </ul>
      </div>
      <div class="actions single"><button class="primary" id="start-mock">${escapeHtml(t("mock.start"))}</button></div>
    </section>
    <aside class="support">
      <section><h2>${escapeHtml(t("mock.regionMix", { region: currentRegionLabel() }))}</h2><p>${escapeHtml(t("mock.mixCopy", { general: catalog.mockExam.generalQuestionCount, regional: catalog.mockExam.regionalQuestionCount }))}</p></section>
      ${renderMockHistorySection()}
    </aside>
  `);

  bindShell();
  app.querySelector<HTMLButtonElement>("#start-mock")?.addEventListener("click", startMockExam);
}

function renderMockReview(): void {
  const session = activeSession();
  const unanswered = session.summary.totalQuestions - session.summary.answered;
  app.innerHTML = layout(`
    <section class="question-area mock-review">
      ${renderMockHeader(session)}
      <p class="completion-label">${escapeHtml(t("mock.reviewLabel"))}</p>
      <h1 data-screen-heading tabindex="-1">${escapeHtml(t("mock.reviewTitle"))}</h1>
      <p class="lead-copy">${escapeHtml(t("mock.reviewCopy", { answered: session.summary.answered, unanswered }))}</p>
      ${renderMockQuestionNavigator(session, { open: true, showReviewAction: false })}
      <div class="submit-warning ${unanswered > 0 ? "has-unanswered" : ""}">
        <strong>${escapeHtml(unanswered > 0 ? t(unanswered === 1 ? "mock.oneUnanswered" : "mock.unansweredCount", { count: unanswered }) : t("mock.allAnswered"))}</strong>
        <span>${escapeHtml(unanswered > 0 ? t("mock.unansweredHelp") : t("mock.readySubmit"))}</span>
      </div>
      <div class="actions"><button class="secondary" id="continue-mock">${escapeHtml(t("mock.continueExam"))}</button><button class="primary" id="submit-mock">${escapeHtml(t("mock.submit"))}</button></div>
    </section>
    ${renderMockPanel(session)}
  `);

  bindShell();
  bindMockNavigator();
  app.querySelector<HTMLButtonElement>("#continue-mock")?.addEventListener("click", () => {
    const nextUnansweredIndex = getMockQuestionStatuses(session).find((status) => !status.isAnswered)?.index;
    mockReviewing = false;
    if (nextUnansweredIndex !== undefined) selectMockQuestion(nextUnansweredIndex);
    else render({ resetView: true });
  });
  app.querySelector<HTMLButtonElement>("#submit-mock")?.addEventListener("click", () => {
    mockSubmitted = true;
    render({ resetView: true });
  });
}

function renderProgress(): void {
  const languageExercises = currentLanguageExercises();
  const summary = summarizeProgress(progress, { languageExerciseCount: languageExercises.length });
  const latestMock = progress.mockExamAttempts[0];

  app.innerHTML = layout(`
    <section class="question-area progress-screen">
      <div class="progress-heading">
        <div><p class="completion-label">${escapeHtml(t("progress.yourLearning"))}</p><h1 data-screen-heading tabindex="-1">${escapeHtml(t("progress.title"))}</h1></div>
        <button class="secondary compact-button" data-mode="practice">${escapeHtml(t("progress.continuePractice"))}</button>
      </div>
      <div class="progress-overview">
        ${metric(t("score.practiceAccuracy"), `${summary.accuracyPercent}%`)}
        ${metric(t("score.germanOnly"), String(summary.germanOnlyCorrect))}
        ${metric(t("score.languageMastered"), `${summary.masteredLanguageItems}/${summary.languageExerciseCount}`)}
        ${metric(t("score.mockAttempts"), String(summary.mockAttempts))}
      </div>
      <section class="progress-section">
        <div class="section-heading"><div><h2>${escapeHtml(t("progress.nextActions"))}</h2><p>${escapeHtml(t("progress.nextActionsCopy"))}</p></div></div>
        <div class="action-list">
          <button class="progress-action" id="practice-bookmarks" ${summary.bookmarkedQuestions === 0 ? "disabled" : ""}><span><strong>${escapeHtml(t("progress.bookmarkedQuestions"))}</strong><small>${escapeHtml(t("progress.saved", { count: summary.bookmarkedQuestions }))}</small></span><b aria-hidden="true">›</b></button>
          <button class="progress-action" data-mode="language"><span><strong>${escapeHtml(t("progress.languageReview"))}</strong><small>${escapeHtml(t("progress.masteredOf", { mastered: summary.masteredLanguageItems, total: summary.languageExerciseCount }))}</small></span><b aria-hidden="true">›</b></button>
          <button class="progress-action" data-mode="mock"><span><strong>${escapeHtml(t("nav.mock"))}</strong><small>${escapeHtml(latestMock ? t("progress.latestScore", { correct: latestMock.correct, total: latestMock.totalQuestions }) : t("common.noAttempts"))}</small></span><b aria-hidden="true">›</b></button>
        </div>
      </section>
      <section class="progress-section">
        <h2>${escapeHtml(t("progress.practiceSummary"))}</h2>
        <p>${escapeHtml(t("progress.practiceSummaryCopy", { practiced: summary.practicedQuestions, correct: summary.correctAnswers, bookmarked: summary.bookmarkedQuestions }))}</p>
      </section>
    </section>
    <aside class="support progress-support">
      ${renderWeakAreasSection()}
      ${renderMockHistorySection()}
    </aside>
  `);

  bindShell();
  app.querySelector<HTMLButtonElement>("#practice-bookmarks")?.addEventListener("click", () => {
    startCustomPractice(t("progress.bookmarkedQuestions"), progress.bookmarkedQuestionIds);
  });
}

function renderMockResult(): void {
  const session = activeSession();
  const result = summarizeMockExam(session, catalog.mockExam);
  saveMockAttemptOnce(result);
  const wrongItems = result.wrongAnswers.map((answer) => renderMockWrongAnswer(answer)).join("");
  clearMockTimer();

  app.innerHTML = layout(`
    <section class="question-area completion">
      <p class="completion-label">${escapeHtml(t("mock.result"))}</p>
      <h1 data-screen-heading tabindex="-1">${escapeHtml(result.passed ? t("mock.passed") : t("mock.notPassed"))}</h1>
      <p class="inline-translation">${escapeHtml(t("mock.resultSummary", { correct: result.correct, total: result.totalQuestions, pass: result.passScore }))} ${result.unanswered > 0 ? escapeHtml(t(isMockExpired() ? "mock.unansweredExpired" : "mock.unansweredSubmitted", { count: result.unanswered })) : ""}</p>
      <div class="score-strip large">
        ${metric(t("score.correct"), String(result.correct))}
        ${metric(t("score.wrongBlank"), String(result.incorrect))}
        ${metric(t("score.passMark"), String(result.passScore))}
        ${metric(t("score.answered"), `${result.answered}/${result.totalQuestions}`)}
      </div>
      <div class="review-list exam-review">
        <h2>${escapeHtml(t("mock.wrongAnswers"))}</h2>
        ${result.wrongAnswers.length > 0 ? `<ul>${wrongItems}</ul>` : `<p>${escapeHtml(t("mock.noWrong"))}</p>`}
      </div>
      <div class="actions"><button class="secondary" id="restart-mock">${escapeHtml(t("mock.restart"))}</button><button class="primary" id="review-wrong" ${result.wrongQuestionIds.length === 0 ? "disabled" : ""}>${escapeHtml(t("mock.reviewWrong"))}</button></div>
    </section>
    <aside class="support"><section><h2>${escapeHtml(t("mock.examRules"))}</h2><p>${escapeHtml(t("mock.mixCopy", { general: catalog.mockExam.generalQuestionCount, regional: catalog.mockExam.regionalQuestionCount }))}</p></section><section><h2>${escapeHtml(t("mock.progressSeparation"))}</h2><p>${escapeHtml(t("mock.progressSeparationCopy"))}</p></section>${renderWeakAreasSection()}${renderMockHistorySection()}</aside>
  `);

  bindShell();
  app.querySelector<HTMLButtonElement>("#restart-mock")?.addEventListener("click", () => {
    startMockExam();
  });
  app.querySelector<HTMLButtonElement>("#review-wrong")?.addEventListener("click", () => {
    startCustomPractice(t("mock.wrongAnswers"), result.wrongQuestionIds);
  });
}

function renderMockWrongAnswer(answer: MockExamWrongAnswer): string {
  const { question, support } = engine.getLearningItem(answer.questionId, selectedSupportLocale);
  const selectedChoiceText = answer.selectedChoiceId
    ? getChoiceText(question, answer.selectedChoiceId)
    : t("mock.noAnswer");
  const correctChoiceText = getChoiceText(question, answer.correctChoiceId ?? question.correctChoiceId);
  const vocabulary = support?.vocabulary.slice(0, 4).map((item) => `
    <li><strong lang="de">${escapeHtml(item.source)}</strong><span>${escapeHtml(item.translation)}</span></li>
  `).join("");

  return `
    <li class="exam-review-card">
      <div class="exam-review-heading">
        <strong>${escapeHtml(question.id)}</strong>
        <span>${escapeHtml(question.topic)}</span>
      </div>
      <h3 lang="de" dir="ltr">${escapeHtml(question.prompt)}</h3>
      ${renderPromptTranslation(support, "review-translation")}
      <div class="answer-comparison">
        <div><span>${escapeHtml(t("mock.yourAnswer"))}</span><strong lang="de" dir="ltr">${escapeHtml(selectedChoiceText)}</strong></div>
        <div><span>${escapeHtml(t("mock.correctAnswer"))}</span><strong lang="de" dir="ltr">${escapeHtml(correctChoiceText)}</strong>${support ? `<small ${supportTextAttributes()}>${escapeHtml(support.correctAnswerTranslation)}</small>` : ""}</div>
      </div>
      <p class="review-explanation" ${supportTextAttributes()}>${escapeHtml(support?.simpleExplanation ?? t("practice.reviewCorrect"))}</p>
      ${vocabulary ? `<div class="review-vocabulary"><span>${escapeHtml(t("practice.keyWords"))}</span><ul>${vocabulary}</ul></div>` : ""}
    </li>
  `;
}

function renderLanguagePractice(): void {
  const languageExercises = currentLanguageExercises();
  const exercise = languageExercises[languageIndex];
  if (!exercise) {
    app.innerHTML = layout(`
      <section class="question-area completion">
        <p class="completion-label">${escapeHtml(t("sidebar.languagePractice"))}</p>
        <h1>${escapeHtml(t("language.noExercises"))}</h1>
        <p class="inline-translation">${escapeHtml(t("language.noExercisesCopy"))}</p>
      </section>
      <aside class="support hidden"></aside>
    `);
    bindShell();
    return;
  }

  const mastery = progress.vocabularyMastery[exercise.id] ?? MIN_MASTERY;
  app.innerHTML = layout(`
    <section class="question-area language-practice">
      <div class="question-meta"><span>${escapeHtml(exercise.type === "vocabulary" ? t("language.vocabulary") : t("language.pattern"))} ${languageIndex + 1} ${escapeHtml(t("common.of"))} ${languageExercises.length}</span><span>${escapeHtml(t("language.mastered", { count: mastery }))}</span></div>
      <h1 lang="de" dir="ltr" data-screen-heading tabindex="-1">${escapeHtml(exercise.prompt)}</h1>
      <p class="inline-translation">${escapeHtml(exercise.hint ?? "Work out the meaning before revealing the answer.")}</p>
      <div class="language-card ${languageRevealed ? "revealed" : ""}">
        <span ${languageRevealed ? supportTextAttributes() : ""}>${languageRevealed ? escapeHtml(exercise.answer) : escapeHtml(t("language.think"))}</span>
      </div>
      <div class="actions language-actions ${languageRevealed ? "revealed" : ""}">
        <button class="secondary" id="language-previous" ${languageIndex === 0 ? "disabled" : ""}>${escapeHtml(t("common.previous"))}</button>
        <button class="secondary" id="reveal">${escapeHtml(languageRevealed ? t("language.hide") : t("language.reveal"))}</button>
        ${languageRevealed ? `<button class="secondary" id="again">${escapeHtml(t("language.again"))}</button><button class="primary" id="known">${escapeHtml(t("language.gotIt"))}</button>` : ""}
      </div>
    </section>
    <aside class="support">
      <section><h2>${escapeHtml(t("language.linkedQuestion"))}</h2><p lang="de" dir="ltr">${escapeHtml(getPrompt(exercise.questionId))}</p></section>
      <section><h2>${escapeHtml(t("language.why"))}</h2><p>${escapeHtml(t("language.whyCopy"))}</p></section>
    </aside>
  `);

  bindShell();
  bindLanguage(exercise);
}

function layout(content: string): string {
  const session = mode === "mock" ? mockSession ?? practiceSession : practiceSession;
  const mockIsActive = mode === "mock" && mockSession !== undefined && !mockSubmitted && !mockSession.summary.isComplete;
  return `
    <header class="topbar ${mockIsActive ? "mock-active" : ""}">
      <a class="brand" href="${hashForMode("practice")}">Leben lernen</a>
      <nav aria-label="${escapeHtml(t("nav.main"))}">
        ${navButton("practice", t("nav.practice"))}
        ${navButton("language", t("nav.language"))}
        ${navButton("mock", t("nav.mock"))}
        ${navButton("progress", t("nav.progress"))}
      </nav>
      <div class="header-tools desktop-header-tools">
        <label class="region"><span>${escapeHtml(t("settings.region"))}</span><select data-setting="region" aria-label="${escapeHtml(t("settings.region"))}">${catalog.regions.map((region) => `<option value="${escapeHtml(region.id)}" ${region.id === selectedRegion ? "selected" : ""}>${escapeHtml(region.label)}</option>`).join("")}</select></label>
        <label class="language"><span>${escapeHtml(t("settings.supportLanguage"))}</span><select data-setting="support-language" aria-label="${escapeHtml(t("settings.supportLanguage"))}">${catalog.supportLocales.map((locale) => `<option value="${escapeHtml(locale.id)}" ${locale.id === selectedSupportLocale ? "selected" : ""}>${escapeHtml(locale.label)}</option>`).join("")}</select></label>
        <label class="language"><span>${escapeHtml(t("settings.interfaceLanguage"))}</span><select data-setting="interface-language" aria-label="${escapeHtml(t("settings.interfaceLanguage"))}">${uiManifest.locales.map((locale) => `<option value="${escapeHtml(locale.id)}" ${locale.id === selectedUiLocale ? "selected" : ""}>${escapeHtml(locale.label)}</option>`).join("")}</select></label>
        <div class="progress-label"><strong>${session.summary.answered}</strong> ${escapeHtml(t("common.of"))} ${session.summary.totalQuestions}</div>
      </div>
      <details class="header-settings">
        <summary><span>${escapeHtml(t("settings.title"))}</span><strong>${escapeHtml(currentRegionLabel())}</strong></summary>
        <div class="header-tools">
          <label class="language"><span>${escapeHtml(t("settings.interfaceLanguage"))}</span><select data-setting="interface-language" aria-label="${escapeHtml(t("settings.interfaceLanguage"))}">${uiManifest.locales.map((locale) => `<option value="${escapeHtml(locale.id)}" ${locale.id === selectedUiLocale ? "selected" : ""}>${escapeHtml(locale.label)}</option>`).join("")}</select></label>
          <label class="language"><span>${escapeHtml(t("settings.supportLanguage"))}</span><select data-setting="support-language" aria-label="${escapeHtml(t("settings.supportLanguage"))}">${catalog.supportLocales.map((locale) => `<option value="${escapeHtml(locale.id)}" ${locale.id === selectedSupportLocale ? "selected" : ""}>${escapeHtml(locale.label)}</option>`).join("")}</select></label>
          <label class="region"><span>${escapeHtml(t("settings.region"))}</span><select data-setting="region" aria-label="${escapeHtml(t("settings.region"))}">${catalog.regions.map((region) => `<option value="${escapeHtml(region.id)}" ${region.id === selectedRegion ? "selected" : ""}>${escapeHtml(region.label)}</option>`).join("")}</select></label>
          <label class="practice-set-setting"><span>${escapeHtml(t("practice.set"))}</span><select data-setting="practice-set" aria-label="${escapeHtml(t("practice.set"))}">${practiceSetOptions()}</select></label>
          <div class="progress-label"><strong>${session.summary.answered}</strong> ${escapeHtml(t("common.of"))} ${session.summary.totalQuestions}</div>
        </div>
      </details>
    </header>
    <main class="shell">
      <aside class="sidebar">
        <section><h2>${escapeHtml(t("sidebar.learningOverview"))}</h2><ol class="topic-list">
          <li class="current"><span>1</span><div><strong>${escapeHtml(t("sidebar.examKnowledge"))}</strong><small>${escapeHtml(t("sidebar.currentScore", { score: session.summary.percentCorrect }))}</small></div></li>
          <li><span>2</span><div><strong>${escapeHtml(t("sidebar.germanOnly"))}</strong><small>${escapeHtml(t("sidebar.correctWithoutSupport", { count: session.summary.germanOnlyCorrect }))}</small></div></li>
          <li><span>3</span><div><strong>${escapeHtml(t("sidebar.wordsPatterns"))}</strong><small>${escapeHtml(t("sidebar.drills", { count: currentLanguageExercises().length }))}</small></div></li>
        </ol></section>
        <button class="side-link" data-mode="progress"><span><strong>${escapeHtml(t("nav.progress"))}</strong><small>${escapeHtml(t("sidebar.progressSubtitle"))}</small></span><b aria-hidden="true">&rsaquo;</b></button>
        <button class="side-link" data-mode="language"><span><strong>${escapeHtml(t("sidebar.languagePractice"))}</strong><small>${escapeHtml(t("sidebar.vocabularyStructure"))}</small></span><b>&rsaquo;</b></button>
        <button class="side-link" data-mode="mock"><span><strong>${escapeHtml(t("sidebar.regionMock", { region: currentRegionLabel() }))}</strong><small>${escapeHtml(t("sidebar.examQuestions", { count: catalog.mockExam.generalQuestionCount + catalog.mockExam.regionalQuestionCount }))}</small></span><b>&rsaquo;</b></button>
      </aside>
      ${content}
    </main>`;
}

function renderPracticeToolbar(session: PracticeSession): string {
  if (customPracticeLabel) {
    return `
      <div class="practice-toolbar">
        <span><strong>${escapeHtml(customPracticeLabel)}</strong></span>
        <button class="secondary compact-button" id="clear-custom-practice">${escapeHtml(t("practice.backSets"))}</button>
      </div>
    `;
  }

  return `
    <div class="practice-toolbar">
      <label><span>${escapeHtml(t("practice.set"))}</span><select data-setting="practice-set" aria-label="${escapeHtml(t("practice.set"))}">${practiceSetOptions()}</select></label>
      <span>${session.summary.totalQuestions} ${escapeHtml(t("common.questions"))}</span>
    </div>
  `;
}

function practiceSetOptions(): string {
  return [
    practiceSetOption("all", t("practice.all")),
    practiceSetOption("unseen", t("practice.unseen")),
    practiceSetOption("wrong", t("practice.wrong")),
    practiceSetOption("bookmarked", t("practice.bookmarkedSet")),
    practiceSetOption("region", t("practice.regionOnly", { region: currentRegionLabel() }))
  ].join("");
}

function renderMockHeader(session: PracticeSession): string {
  return `
    <div class="mock-header">
      <span><strong data-mock-timer>${formatRemainingTime()}</strong><small> ${escapeHtml(t("mock.remaining"))}</small></span>
      <span>${session.summary.answered}/${session.summary.totalQuestions} ${escapeHtml(t("score.answered"))}</span>
      <button class="secondary compact-button" id="exit-mock">${escapeHtml(t("mock.exit"))}</button>
    </div>
  `;
}

function renderMockQuestionNavigator(
  session: PracticeSession,
  options: { readonly open?: boolean; readonly showReviewAction?: boolean } = {}
): string {
  const statuses = getMockQuestionStatuses(session);
  const showReviewAction = options.showReviewAction ?? true;
  return `
    <details class="mock-question-nav" ${options.open ? "open" : ""}>
      <summary><span>${escapeHtml(t("mock.questionNav"))}</span><strong>${session.summary.answered}/${session.summary.totalQuestions}</strong></summary>
      <div class="mock-question-grid">${statuses.map((status) => {
        const state = status.isAnswered ? " answered" : "";
        const current = status.isCurrent ? " current" : "";
        const stateLabel = `${t(status.isAnswered ? "mock.answeredStatus" : "mock.unansweredStatus")}${status.isCurrent ? `, ${t("mock.currentStatus")}` : ""}`;
        const label = t("mock.questionStatus", { number: status.index + 1, status: stateLabel });
        return `<button class="mock-question-button${state}${current}" data-mock-index="${status.index}" aria-label="${label}" ${status.isCurrent ? 'aria-current="step"' : ""}>${status.index + 1}</button>`;
      }).join("")}</div>
      ${showReviewAction ? `<button class="secondary compact-button full-width" id="review-mock">${escapeHtml(t("mock.reviewFinish"))}</button>` : ""}
    </details>
  `;
}

function renderMockPanel(session: PracticeSession): string {
  return `
    <aside class="support">
      <section><h2>${escapeHtml(t("mock.timer"))}</h2><p class="answer-translation" data-mock-timer>${formatRemainingTime()}</p></section>
      <section><h2>${escapeHtml(t("mock.passingScore"))}</h2><p>${escapeHtml(t("mock.passingCopy", { count: catalog.mockExam.passScore }))}</p></section>
      <section><h2>${escapeHtml(t("mock.examMode"))}</h2><p>${escapeHtml(t("mock.examModeCopy"))}</p></section>
      <section><h2>${escapeHtml(t("mock.questionMix"))}</h2><p>${escapeHtml(t("mock.mixCopy", { general: catalog.mockExam.generalQuestionCount, regional: catalog.mockExam.regionalQuestionCount }))}</p></section>
      <section><h2>${escapeHtml(t("mock.progress"))}</h2><p>${escapeHtml(t("mock.progressCopy", { answered: session.summary.answered, total: session.summary.totalQuestions }))}</p></section>
      ${renderWeakAreasSection()}
      ${renderMockHistorySection()}
    </aside>`;
}

function renderWeakAreasSection(): string {
  const weakTopics = currentWeakTopics().slice(0, 3);
  return `
    <section>
      <h2>${escapeHtml(t("mock.weakAreas"))}</h2>
      ${weakTopics.length > 0 ? `<ol class="weak-topic-list">${weakTopics.map(renderWeakTopic).join("")}</ol><button class="secondary compact-button full-width" id="practice-weakest-topic">${escapeHtml(t("mock.practiceWeakest"))}</button>` : `<p>${escapeHtml(t("mock.weakEmpty"))}</p>`}
    </section>
  `;
}

function renderWeakTopic(topic: WeakTopicSummary): string {
  return `
    <li>
      <strong>${escapeHtml(topicLabel(topic.topic))}</strong>
      <span>${escapeHtml(t("mock.weakSummary", { wrong: topic.wrongCount, questions: topic.questionIds.length }))}</span>
    </li>
  `;
}

function renderMockHistorySection(): string {
  const attempts = progress.mockExamAttempts.slice(0, 5);
  return `
    <section>
      <h2>${escapeHtml(t("mock.history"))}</h2>
      ${attempts.length > 0 ? `<ol class="mock-history">${attempts.map(renderMockAttempt).join("")}</ol>` : `<p>${escapeHtml(t("common.noAttempts"))}</p>`}
    </section>
  `;
}

function renderMockAttempt(attempt: MockExamAttempt): string {
  return `
    <li>
      <strong>${attempt.correct}/${attempt.totalQuestions}</strong>
      <span>${escapeHtml(attempt.passed ? t("mock.passed") : t("mock.notPassed"))} · ${escapeHtml(regionLabel(attempt.region))}</span>
      <small>${escapeHtml(formatDateTime(attempt.completedAt))}</small>
    </li>
  `;
}

function practiceSetOption(value: PracticeSet, label: string): string {
  return `<option value="${value}" ${selectedPracticeSet === value ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function renderSupportPanel(questionId: QuestionId): string {
  const { support } = engine.getLearningItem(questionId, selectedSupportLocale);
  return `
    <aside class="support support-panel ${showSupport ? "" : "hidden"}">
      <details class="support-disclosure" open>
        <summary>${escapeHtml(t("practice.studyQuestion"))}</summary>
        <div class="support-content">
          <section><h2>${escapeHtml(t("practice.keyWords"))}</h2><dl>${support?.vocabulary.map((item) => `<div><dt lang="de" dir="ltr">${escapeHtml(item.source)}</dt><dd ${supportTextAttributes()}>${escapeHtml(item.translation)}</dd></div>`).join("") ?? ""}</dl></section>
          ${support?.germanPattern ? `<section><h2>${escapeHtml(t("practice.germanPattern"))}</h2><p><strong lang="de" dir="ltr">${escapeHtml(support.germanPattern.pattern)}</strong><br><span ${supportTextAttributes()}>${escapeHtml(support.germanPattern.meaning)}</span></p></section>` : ""}
        </div>
      </details>
    </aside>`;
}

function renderMobileStudyPreview(support: LearningSupport | undefined): string {
  const terms = support?.vocabulary.slice(0, 2) ?? [];
  if (terms.length === 0) return "";
  return `
    <section class="mobile-study-preview" aria-label="${escapeHtml(t("practice.keyWords"))}">
      <h2>${escapeHtml(t("practice.keyWords"))}</h2>
      <dl>${terms.map((item) => `<div><dt lang="de" dir="ltr">${escapeHtml(item.source)}</dt><dd ${supportTextAttributes()}>${escapeHtml(item.translation)}</dd></div>`).join("")}</dl>
    </section>
  `;
}

function renderPromptTranslation(
  support: LearningSupport | undefined,
  className = "inline-translation"
): string {
  if (hasPromptTranslation(support)) {
    return `<p class="${className}" ${supportTextAttributes()}>${escapeHtml(support.translation)}</p>`;
  }
  return `<p class="${className} translation-pending">${escapeHtml(t("practice.translationPending"))}</p>`;
}

function bindShell(): void {
  app.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => button.addEventListener("click", () => {
    navigateToMode(button.dataset.mode as PracticeMode);
  }));
  app.querySelectorAll<HTMLSelectElement>('select[data-setting="region"]').forEach((select) => select.addEventListener("change", (event) => {
    selectedRegion = (event.currentTarget as HTMLSelectElement).value;
    customPracticeLabel = undefined;
    resetPracticeSession();
    mockSession = undefined;
    mockDeadlineAt = 0;
    mockReviewing = false;
    mockSubmitted = false;
    selected = undefined;
    checked = false;
    usedSupportForQuestion = showSupport;
    render();
  }));
  app.querySelectorAll<HTMLSelectElement>('select[data-setting="support-language"]').forEach((select) => select.addEventListener("change", (event) => {
    selectedSupportLocale = (event.currentTarget as HTMLSelectElement).value;
    languageIndex = Math.min(languageIndex, Math.max(currentLanguageExercises().length - 1, 0));
    languageRevealed = false;
    usedSupportForQuestion = usedSupportForQuestion || showSupport;
    render();
  }));
  app.querySelectorAll<HTMLSelectElement>('select[data-setting="interface-language"]').forEach((select) => select.addEventListener("change", (event) => {
    selectedUiLocale = (event.currentTarget as HTMLSelectElement).value;
    window.localStorage.setItem(UI_LOCALE_STORAGE_KEY, selectedUiLocale);
    updateUiTranslator();
    applyDocumentLocale();
    render();
  }));
  app.querySelectorAll<HTMLSelectElement>('select[data-setting="practice-set"]').forEach((select) => select.addEventListener("change", (event) => {
    selectedPracticeSet = (event.currentTarget as HTMLSelectElement).value as PracticeSet;
    customPracticeLabel = undefined;
    resetPracticeSession();
    selected = undefined;
    checked = false;
    usedSupportForQuestion = showSupport;
    render();
  }));
  app.querySelector<HTMLButtonElement>("#clear-custom-practice")?.addEventListener("click", () => {
    customPracticeLabel = undefined;
    resetPracticeSession();
    selected = undefined;
    checked = false;
    usedSupportForQuestion = showSupport;
    render();
  });
  app.querySelector<HTMLButtonElement>("#practice-weakest-topic")?.addEventListener("click", () => {
    const weakestTopic = currentWeakTopics()[0];
    if (!weakestTopic) return;
    startCustomPractice(t("mock.weakAreaLabel", { topic: topicLabel(weakestTopic.topic) }), weakestTopic.questionIds);
  });
  app.querySelector<HTMLButtonElement>("#exit-mock")?.addEventListener("click", () => {
    clearMockTimer();
    mockSession = undefined;
    mockDeadlineAt = 0;
    mockReviewing = false;
    mockSubmitted = false;
    selected = undefined;
    checked = false;
    navigateToMode("practice");
  });
}

function bindQuestion(): void {
  app.querySelectorAll<HTMLInputElement>('input[name="answer"]').forEach((input) => input.addEventListener("change", () => {
    selected = input.value as ChoiceId;
    checked = false;
    render();
  }));
  app.querySelector<HTMLInputElement>(".toggle input")?.addEventListener("change", (event) => {
    showSupport = (event.currentTarget as HTMLInputElement).checked;
    usedSupportForQuestion = usedSupportForQuestion || showSupport;
    render();
  });
  app.querySelector<HTMLButtonElement>("#bookmark")?.addEventListener("click", () => {
    progress = toggleBookmark(progress, currentQuestion().id, new Date().toISOString());
    saveProgress(progress);
    render();
  });
  app.querySelector<HTMLButtonElement>("#previous")?.addEventListener("click", () => {
    const session = activeSession();
    if (session.currentIndex === 0) return;
    if (mode === "mock") {
      saveCurrentMockSelection();
      selectMockQuestion(session.currentIndex - 1);
      return;
    }
    setActiveSession({ ...session, currentIndex: session.currentIndex - 1 });
    selected = undefined;
    checked = false;
    usedSupportForQuestion = showSupport;
    render({ resetView: true });
  });
  app.querySelector<HTMLButtonElement>("#check")?.addEventListener("click", () => {
    if (!selected) return;
    if (mode === "mock") {
      answerMockQuestion(selected);
      return;
    }
    const movesToNextQuestion = checked;
    if (!checked) {
      checked = true;
      const question = currentQuestion();
      const nextSession = recordSessionAnswer(activeSession(), {
        question,
        selectedChoiceId: selected,
        usedSupport: usedSupportForQuestion,
        answeredAt: new Date().toISOString()
      });
      setActiveSession(nextSession);
      progress = {
        ...progress,
        updatedAt: new Date().toISOString(),
        answers: nextSession.answers
      };
      saveProgress(progress);
    } else {
      setActiveSession(moveToNextQuestion(activeSession()));
      selected = undefined;
      checked = false;
      usedSupportForQuestion = showSupport;
    }
    render({ resetView: movesToNextQuestion });
  });
  if (mode === "mock") bindMockNavigator();
}

function bindMockNavigator(): void {
  app.querySelectorAll<HTMLButtonElement>("[data-mock-index]").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.mockIndex);
    if (!Number.isInteger(index)) return;
    saveCurrentMockSelection();
    mockReviewing = false;
    selectMockQuestion(index);
  }));
  app.querySelector<HTMLButtonElement>("#review-mock")?.addEventListener("click", () => {
    saveCurrentMockSelection();
    mockReviewing = true;
    render({ resetView: true });
  });
}

function saveCurrentMockSelection(): void {
  if (!selected || mode !== "mock" || !mockSession) return;
  const question = currentQuestion();
  setActiveSession(recordSessionAnswer(activeSession(), {
    question,
    selectedChoiceId: selected,
    usedSupport: false,
    answeredAt: new Date().toISOString()
  }));
}

function selectMockQuestion(index: number): void {
  const session = activeSession();
  if (index < 0 || index >= session.questionIds.length) return;
  const questionId = session.questionIds[index];
  const savedAnswer = session.answers.find((answer) => answer.questionId === questionId);
  setActiveSession({ ...session, currentIndex: index });
  selected = savedAnswer?.selectedChoiceId;
  checked = false;
  render({ resetView: true });
}

function answerMockQuestion(selectedChoiceId: ChoiceId): void {
  const question = currentQuestion();
  const answeredSession = recordSessionAnswer(activeSession(), {
    question,
    selectedChoiceId,
    usedSupport: false,
    answeredAt: new Date().toISOString()
  });
  const isLastQuestion = answeredSession.currentIndex >= answeredSession.questionIds.length - 1;
  setActiveSession(isLastQuestion ? answeredSession : moveToNextQuestion(answeredSession));
  mockReviewing = isLastQuestion;
  selected = undefined;
  checked = false;
  usedSupportForQuestion = false;
  render({ resetView: true });
}

function bindLanguage(exercise: LanguageExercise): void {
  app.querySelector<HTMLButtonElement>("#language-previous")?.addEventListener("click", () => {
    languageIndex = Math.max(languageIndex - 1, 0);
    languageRevealed = false;
    render({ resetView: true });
  });
  app.querySelector<HTMLButtonElement>("#reveal")?.addEventListener("click", () => {
    languageRevealed = !languageRevealed;
    render();
  });
  app.querySelector<HTMLButtonElement>("#again")?.addEventListener("click", () => rateLanguageExercise(exercise, "again"));
  app.querySelector<HTMLButtonElement>("#known")?.addEventListener("click", () => rateLanguageExercise(exercise, "got_it"));
}

function rateLanguageExercise(exercise: LanguageExercise, rating: "again" | "got_it"): void {
  progress = updateVocabularyMastery(progress, {
    exerciseId: exercise.id,
    rating,
    updatedAt: new Date().toISOString()
  });
  saveProgress(progress);
  languageIndex = Math.min(languageIndex + 1, currentLanguageExercises().length - 1);
  languageRevealed = false;
  render({ resetView: true });
}

function navButton(value: PracticeMode, label: string): string {
  const isActive = mode === value;
  const mockIsActive = mode === "mock" && mockSession !== undefined && !mockSubmitted && !mockSession.summary.isComplete;
  const isDisabled = mockIsActive && value !== "mock";
  return `<button class="nav-item ${isActive ? "active" : ""}" data-mode="${value}" ${isActive ? 'aria-current="page"' : ""} ${isDisabled ? "disabled" : ""}>${label}</button>`;
}

function metric(label: string, value: string): string {
  return `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
}

function getPrompt(questionId: QuestionId): string {
  return engine.getLearningItem(questionId, selectedSupportLocale).question.prompt;
}

function getChoiceText(question: SourceQuestion, choiceId: ChoiceId): string {
  return question.choices.find((choice) => choice.id === choiceId)?.text ?? choiceId;
}

function currentRegionLabel(): string {
  return catalog.regions.find((region) => region.id === selectedRegion)?.label ?? selectedRegion;
}

function regionLabel(regionId: string): string {
  return catalog.regions.find((region) => region.id === regionId)?.label ?? regionId;
}

function currentSupportLocaleLabel(): string {
  return catalog.supportLocales.find((locale) => locale.id === selectedSupportLocale)?.label ?? selectedSupportLocale;
}

function supportTextAttributes(): string {
  return `lang="${escapeHtml(selectedSupportLocale)}" dir="${supportTextDirection()}"`;
}

function supportTextDirection(): "ltr" | "rtl" {
  return RTL_SUPPORT_LOCALES.has(selectedSupportLocale) ? "rtl" : "ltr";
}

function currentLanguageExercises(): readonly LanguageExercise[] {
  return createLanguageExercises(getSupportPack(supportPacks, selectedSupportLocale));
}

function currentPracticeQuestionIds(): readonly QuestionId[] {
  return getPracticeSetQuestionIds(catalog, {
    region: selectedRegion,
    practiceSet: selectedPracticeSet,
    progress
  });
}

function currentWeakTopics(): readonly WeakTopicSummary[] {
  return summarizeWeakTopics(catalog, progress.mockExamAttempts);
}

function topicLabel(topic: string): string {
  const localized = t(`topic.${topic}`);
  if (localized !== `topic.${topic}`) return localized;
  return topic
    .split(/[-_\s]+/u)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function resetPracticeSession(): void {
  practiceSession = hydratePracticeSession(currentPracticeQuestionIds(), progress.answers);
}

function startCustomPractice(label: string, questionIds: readonly QuestionId[]): void {
  customPracticeLabel = label;
  practiceSession = createPracticeSession(questionIds);
  selected = undefined;
  checked = false;
  usedSupportForQuestion = showSupport;
  navigateToMode("practice");
}

function createMockSession(): PracticeSession {
  mockStartedAt = new Date().toISOString();
  mockAttemptSaved = false;
  mockReviewing = false;
  mockSubmitted = false;
  const session = createPracticeSession(createMockExamQuestionIds(catalog, {
    region: selectedRegion,
    seed: Date.now()
  }));
  mockDeadlineAt = Date.now() + catalog.mockExam.durationMinutes * MILLISECONDS_PER_MINUTE;
  ensureMockTimer();
  return session;
}

function startMockExam(): void {
  mode = "mock";
  mockSession = createMockSession();
  selected = undefined;
  checked = false;
  usedSupportForQuestion = false;
  render({ resetView: true });
}

function navigateToMode(nextMode: PracticeMode): void {
  const nextHash = hashForMode(nextMode);
  if (window.location.hash === nextHash) {
    activateMode(nextMode);
    return;
  }
  window.location.hash = nextHash;
}

function activateMode(nextMode: PracticeMode): void {
  const mockIsActive = mode === "mock" && mockSession !== undefined && !mockSubmitted && !mockSession.summary.isComplete;
  if (mockIsActive && nextMode !== "mock") {
    window.history.replaceState(null, "", hashForMode("mock"));
    return;
  }
  mode = nextMode;
  if (mode !== "practice") customPracticeLabel = undefined;
  selected = undefined;
  checked = false;
  render({ resetView: true });
}

function handleHashChange(): void {
  activateMode(modeFromHash(window.location.hash));
}

function resetScreenPosition(): void {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  app.querySelector<HTMLElement>("[data-screen-heading]")?.focus({ preventScroll: true });
}

function saveMockAttemptOnce(result: MockExamResult): void {
  if (mockAttemptSaved) return;
  const completedAt = new Date().toISOString();
  progress = recordMockExamAttempt(progress, {
    id: `${mockStartedAt}:${selectedRegion}`,
    completedAt,
    region: selectedRegion,
    totalQuestions: result.totalQuestions,
    correct: result.correct,
    passScore: result.passScore,
    passed: result.passed,
    wrongQuestionIds: result.wrongQuestionIds
  });
  saveProgress(progress);
  mockAttemptSaved = true;
}

function ensureMockTimer(): void {
  if (mockTimerId !== undefined) return;
  mockTimerId = window.setInterval(() => {
    if (mode !== "mock" || !mockSession || mockSession.summary.isComplete) {
      clearMockTimer();
      return;
    }
    if (isMockExpired()) {
      render();
      return;
    }
    updateMockTimerDisplays();
  }, MILLISECONDS_PER_SECOND);
}

function updateMockTimerDisplays(): void {
  const remainingTime = formatRemainingTime();
  app.querySelectorAll<HTMLElement>(MOCK_TIMER_SELECTOR).forEach((element) => {
    element.textContent = remainingTime;
  });
}

function clearMockTimer(): void {
  if (mockTimerId === undefined) return;
  window.clearInterval(mockTimerId);
  mockTimerId = undefined;
}

function updateMockTimer(): void {
  if (mode === "mock" && mockSession && !mockSession.summary.isComplete && !isMockExpired()) {
    ensureMockTimer();
    return;
  }
  if (mode !== "mock" || isMockExpired() || mockSession?.summary.isComplete) clearMockTimer();
}

function isMockExpired(): boolean {
  return mode === "mock" && mockDeadlineAt > 0 && Date.now() >= mockDeadlineAt;
}

function formatRemainingTime(): string {
  const remainingMs = Math.max(mockDeadlineAt - Date.now(), 0);
  const totalSeconds = Math.ceil(remainingMs / MILLISECONDS_PER_SECOND);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function isCurrentQuestionBookmarked(): boolean {
  return progress.bookmarkedQuestionIds.includes(currentQuestion().id);
}

function publicAssetPath(path: string): string {
  return `${PUBLIC_BASE_URL}${path.replace(/^\/+/u, "")}`;
}

function loadProgress(): ProgressSnapshot {
  const fallback: ProgressSnapshot = {
    version: 1,
    updatedAt: new Date().toISOString(),
    answers: [],
    bookmarkedQuestionIds: [],
    mockExamAttempts: [],
    vocabularyMastery: {}
  };
  const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as ProgressSnapshot;
    return parsed.version === 1 ? {
      ...fallback,
      ...parsed,
      bookmarkedQuestionIds: parsed.bookmarkedQuestionIds ?? [],
      mockExamAttempts: parsed.mockExamAttempts ?? []
    } : fallback;
  } catch {
    return fallback;
  }
}

function saveProgress(snapshot: ProgressSnapshot): void {
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(snapshot));
}

function createProgressSnapshot(): ProgressSnapshot {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    answers: [],
    bookmarkedQuestionIds: [],
    mockExamAttempts: [],
    vocabularyMastery: {}
  };
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(selectedUiLocale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function updateUiTranslator(): void {
  const fallback = uiMessages[uiManifest.defaultLocale] ?? {};
  t = createUiTranslator(uiMessages[selectedUiLocale] ?? fallback, fallback);
}

function applyDocumentLocale(): void {
  const option = uiManifest.locales.find((locale) => locale.id === selectedUiLocale);
  document.documentElement.lang = selectedUiLocale;
  document.documentElement.dir = option?.direction ?? "ltr";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function start(): Promise<void> {
  const [bundle, uiBundle] = await Promise.all([
    createFetchCatalogLoader().loadBundle(),
    createFetchUiLoader().loadBundle()
  ]);
  catalog = bundle.catalog;
  supportPacks = bundle.supportPacks;
  uiManifest = uiBundle.manifest;
  uiMessages = uiBundle.messages;
  const savedUiLocale = window.localStorage.getItem(UI_LOCALE_STORAGE_KEY);
  selectedUiLocale = uiManifest.locales.some((locale) => locale.id === savedUiLocale)
    ? savedUiLocale as string
    : uiManifest.defaultLocale;
  updateUiTranslator();
  applyDocumentLocale();
  engine = createPracticeEngine(catalog.questions, getAllSupportPacks(supportPacks));
  progress = loadProgress();
  selectedRegion = catalog.defaultRegion;
  selectedSupportLocale = catalog.supportLocales[0]?.id ?? "";
  resetPracticeSession();
  const initialHash = hashForMode(mode);
  if (window.location.hash !== initialHash) window.history.replaceState(null, "", initialHash);
  window.addEventListener("hashchange", handleHashChange);
  render();
}

start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : t("app.unknownError");
  app.innerHTML = `<main class="loading-state error"><h1>${escapeHtml(t("app.loadError"))}</h1><p>${escapeHtml(message)}</p></main>`;
});

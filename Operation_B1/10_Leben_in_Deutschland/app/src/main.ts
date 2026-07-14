import "./styles.css";
import {
  createFetchCatalogLoader,
  getAllSupportPacks,
  getSupportPack
} from "./data/catalog-loader";
import {
  createLanguageExercises,
  createMockExamQuestionIds,
  createPracticeEngine,
  createPracticeSession,
  getPracticeSetQuestionIds,
  hydratePracticeSession,
  moveToNextQuestion,
  recordMockExamAttempt,
  recordSessionAnswer,
  summarizeMockExam,
  summarizeWeakTopics,
  toggleBookmark
} from "./domain/practice-engine";
import type { PracticeEngine } from "./domain/practice-engine";
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
const VOCABULARY_STEP = 25;
const MAX_MASTERY = 100;
const MIN_MASTERY = 0;
const PUBLIC_BASE_URL = import.meta.env.BASE_URL;
const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_SECOND = 1_000;
const RTL_SUPPORT_LOCALES = new Set(["ar"]);

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("App root is missing");
const app: HTMLDivElement = root;
app.innerHTML = `<main class="loading-state"><p>Loading practice data…</p></main>`;

let catalog: ExamCatalog;
let engine: PracticeEngine;
let supportPacks: Readonly<Record<string, readonly LearningSupport[]>>;
let progress: ProgressSnapshot;
let mode: PracticeMode = "practice";
let selectedRegion = "";
let selectedSupportLocale = "";
let selectedPracticeSet: PracticeSet = "all";
let practiceSession: PracticeSession;
let mockSession: PracticeSession | undefined;
let mockDeadlineAt = 0;
let mockTimerId: number | undefined;
let mockStartedAt = "";
let mockAttemptSaved = false;
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
  mockSession ??= createMockSession();
  return mockSession;
}

function setActiveSession(nextSession: PracticeSession): void {
  if (mode === "mock") {
    mockSession = nextSession;
  } else {
    practiceSession = nextSession;
  }
}

function render(): void {
  updateMockTimer();

  if (mode === "language") {
    renderLanguagePractice();
    return;
  }

  if (mode === "practice" && activeSession().questionIds.length === 0) {
    renderEmptyPracticeSet();
    return;
  }

  if (mode === "mock" && (activeSession().summary.isComplete || isMockExpired())) {
    renderMockResult();
    return;
  }

  if (activeSession().summary.isComplete) {
    renderCompletion();
    return;
  }

  renderQuestion();
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
    ? session.currentIndex === session.questionIds.length - 1 ? "Finish exam" : "Save and next"
    : checked ? session.summary.isComplete ? "See results" : "Next question" : "Check answer";

  app.innerHTML = layout(`
    <section class="question-area">
      ${mode === "practice" ? renderPracticeToolbar(session) : ""}
      ${isMockExam ? renderMockHeader(session) : ""}
      <div class="score-strip" aria-label="Session score">
        ${metric("Score", `${session.summary.percentCorrect}%`)}
        ${metric("Correct", `${session.summary.correct}/${session.summary.answered}`)}
        ${metric("German only", `${session.summary.germanOnlyCorrect}`)}
        ${metric("Assisted", `${session.summary.assisted}`)}
      </div>
      <div class="question-meta"><span>Question ${session.currentIndex + 1}</span>${isMockExam ? `<span>No hints or answer feedback during mock exam</span>` : `<div class="question-tools"><button class="bookmark-button ${isCurrentQuestionBookmarked() ? "active" : ""}" id="bookmark" aria-pressed="${isCurrentQuestionBookmarked()}">${isCurrentQuestionBookmarked() ? "★ Bookmarked" : "☆ Bookmark"}</button><label class="toggle"><span>Show translation</span><input type="checkbox" ${showSupport ? "checked" : ""}><i></i></label></div>`}</div>
      <h1 lang="de">${escapeHtml(question.prompt)}</h1>
      ${!isMockExam && showSupport && support ? `<p class="inline-translation" ${supportTextAttributes()}>${escapeHtml(support.translation)}</p>` : ""}
      ${question.image ? `<figure class="catalog-figure"><img src="${escapeHtml(publicAssetPath(`catalog-pages/${question.image}.png`))}" alt="Official BAMF catalog visual for ${escapeHtml(question.id)}"></figure>` : ""}
      <fieldset><legend class="sr-only">Choose one answer</legend>${question.choices.map((choice) => {
        const isSelected = selected === choice.id;
        const state = checked ? choice.id === question.correctChoiceId ? " correct" : isSelected ? " wrong" : "" : "";
        return `<label class="answer${isSelected ? " selected" : ""}${state}"><input type="radio" name="answer" value="${choice.id}" ${isSelected ? "checked" : ""}><span class="radio"></span><span lang="de">${escapeHtml(choice.text)}</span></label>`;
      }).join("")}</fieldset>
      ${result ? `<div class="feedback ${result.isCorrect ? "success" : "error"}" role="status"><strong>${result.isCorrect ? "Correct" : "Not quite"}</strong>${support ? `<span ${supportTextAttributes()}>Translated answer: ${escapeHtml(support.correctAnswerTranslation)}</span>` : ""}<span ${supportTextAttributes()}>${escapeHtml(support?.simpleExplanation ?? "Review the correct answer.")}</span></div>` : ""}
      <div class="actions"><button class="secondary" id="previous" ${session.currentIndex === 0 ? "disabled" : ""}>Previous</button><button class="primary" id="check" ${selected ? "" : "disabled"}>${primaryLabel}</button></div>
      <div class="progress-note"><span class="progress-track"><i style="width:${progressPercent}%"></i></span><span>${session.summary.answered} answered in this set</span></div>
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
      <p class="completion-label">No questions in this set</p>
      <h1>Nothing to review yet</h1>
      <p class="inline-translation">Try All questions, answer a few questions, or bookmark questions first.</p>
    </section>
    <aside class="support"><section><h2>Practice sets</h2><p>Review sets are built from your saved progress in this browser.</p></section></aside>
  `);

  bindShell();
}

function renderCompletion(): void {
  const session = activeSession();
  const completionLabel = mode === "mock" ? "Mock exam complete" : "Practice complete";
  app.innerHTML = layout(`
    <section class="question-area completion">
      <p class="completion-label">${completionLabel}</p>
      <h1>${session.summary.percentCorrect}% score</h1>
      <p class="inline-translation">You answered ${session.summary.correct} of ${session.summary.totalQuestions} available questions correctly. ${session.summary.assisted} answers used support.</p>
      <div class="score-strip large">
        ${metric("Correct", String(session.summary.correct))}
        ${metric("German-only correct", String(session.summary.germanOnlyCorrect))}
        ${metric("Needs review", String(session.summary.difficultQuestionIds.length))}
        ${metric("Streak", String(session.summary.currentStreak))}
      </div>
      <div class="review-list">
        <h2>Review next</h2>
        ${session.summary.difficultQuestionIds.length > 0
          ? `<ul>${session.summary.difficultQuestionIds.map((id) => `<li>${escapeHtml(id)}</li>`).join("")}</ul>`
          : "<p>No difficult questions in this run.</p>"}
      </div>
      <div class="actions"><button class="secondary" id="reset-progress">Reset progress</button><button class="primary" id="restart">Start again</button></div>
    </section>
    <aside class="support"><section><h2>Next focus</h2><p>Switch to Language to drill the German words and sentence patterns from these questions.</p></section></aside>
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

function renderMockResult(): void {
  const session = activeSession();
  const result = summarizeMockExam(session, catalog.mockExam);
  saveMockAttemptOnce(result);
  const wrongItems = result.wrongAnswers.map((answer) => renderMockWrongAnswer(answer)).join("");
  clearMockTimer();

  app.innerHTML = layout(`
    <section class="question-area completion">
      <p class="completion-label">Mock exam result</p>
      <h1>${result.passed ? "Passed" : "Not passed yet"}</h1>
      <p class="inline-translation">You scored ${result.correct} of ${result.totalQuestions}. Passing score is ${result.passScore} of ${result.totalQuestions}. ${result.unanswered > 0 ? `${result.unanswered} questions were unanswered when time ended.` : ""}</p>
      <div class="score-strip large">
        ${metric("Correct", String(result.correct))}
        ${metric("Wrong or blank", String(result.incorrect))}
        ${metric("Pass mark", String(result.passScore))}
        ${metric("Answered", `${result.answered}/${result.totalQuestions}`)}
      </div>
      <div class="review-list exam-review">
        <h2>Wrong answers</h2>
        ${result.wrongAnswers.length > 0 ? `<ul>${wrongItems}</ul>` : "<p>No wrong answers in this mock exam.</p>"}
      </div>
      <div class="actions"><button class="secondary" id="restart-mock">Restart mock</button><button class="primary" id="review-wrong" ${result.wrongQuestionIds.length === 0 ? "disabled" : ""}>Review wrong answers</button></div>
    </section>
    <aside class="support"><section><h2>Exam rules</h2><p>This mock uses ${catalog.mockExam.generalQuestionCount} general questions and ${catalog.mockExam.regionalQuestionCount} regional questions for ${escapeHtml(currentRegionLabel())}.</p></section><section><h2>Progress separation</h2><p>Mock exam answers are saved only to mock history. They do not change your normal practice score.</p></section>${renderWeakAreasSection()}${renderMockHistorySection()}</aside>
  `);

  bindShell();
  app.querySelector<HTMLButtonElement>("#restart-mock")?.addEventListener("click", () => {
    startMockExam();
  });
  app.querySelector<HTMLButtonElement>("#review-wrong")?.addEventListener("click", () => {
    startCustomPractice("Mock wrong answers", result.wrongQuestionIds);
  });
}

function renderMockWrongAnswer(answer: MockExamWrongAnswer): string {
  const { question, support } = engine.getLearningItem(answer.questionId, selectedSupportLocale);
  const selectedChoiceText = answer.selectedChoiceId
    ? getChoiceText(question, answer.selectedChoiceId)
    : "No answer selected";
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
      <h3 lang="de">${escapeHtml(question.prompt)}</h3>
      ${support ? `<p class="review-translation" ${supportTextAttributes()}>${escapeHtml(support.translation)}</p>` : ""}
      <div class="answer-comparison">
        <div><span>Your answer</span><strong lang="de">${escapeHtml(selectedChoiceText)}</strong></div>
        <div><span>Correct answer</span><strong lang="de">${escapeHtml(correctChoiceText)}</strong>${support ? `<small ${supportTextAttributes()}>${escapeHtml(support.correctAnswerTranslation)}</small>` : ""}</div>
      </div>
      <p class="review-explanation" ${supportTextAttributes()}>${escapeHtml(support?.simpleExplanation ?? "Review the correct answer and key words for this question.")}</p>
      ${vocabulary ? `<div class="review-vocabulary"><span>Key words</span><ul>${vocabulary}</ul></div>` : ""}
    </li>
  `;
}

function renderLanguagePractice(): void {
  const languageExercises = currentLanguageExercises();
  const exercise = languageExercises[languageIndex];
  if (!exercise) {
    app.innerHTML = layout(`
      <section class="question-area completion">
        <p class="completion-label">Language practice</p>
        <h1>No exercises yet</h1>
        <p class="inline-translation">Language exercises appear when the selected support pack has vocabulary or grammar patterns.</p>
      </section>
      <aside class="support hidden"></aside>
    `);
    bindShell();
    return;
  }

  const mastery = progress.vocabularyMastery[exercise.id] ?? MIN_MASTERY;
  app.innerHTML = layout(`
    <section class="question-area language-practice">
      <div class="question-meta"><span>${exercise.type === "vocabulary" ? "Vocabulary" : "German pattern"} ${languageIndex + 1} of ${languageExercises.length}</span><span>${mastery}% mastered</span></div>
      <h1 lang="de">${escapeHtml(exercise.prompt)}</h1>
      <p class="inline-translation">${escapeHtml(exercise.hint ?? "Work out the meaning before revealing the answer.")}</p>
      <div class="language-card ${languageRevealed ? "revealed" : ""}">
        <span ${languageRevealed ? supportTextAttributes() : ""}>${languageRevealed ? escapeHtml(exercise.answer) : "Think first, then reveal."}</span>
      </div>
      <div class="actions language-actions">
        <button class="secondary" id="language-previous" ${languageIndex === 0 ? "disabled" : ""}>Previous</button>
        <button class="secondary" id="reveal">${languageRevealed ? "Hide" : "Reveal"}</button>
        <button class="primary" id="known">I know this</button>
      </div>
    </section>
    <aside class="support">
      <section><h2>Linked question</h2><p>${escapeHtml(getPrompt(exercise.questionId))}</p></section>
      <section><h2>Why this helps</h2><p>These drills are separate from exam score. They train the words and structures needed to understand the German question without leaning on support.</p></section>
    </aside>
  `);

  bindShell();
  bindLanguage(exercise);
}

function layout(content: string): string {
  const session = activeSession();
  return `
    <header class="topbar">
      <a class="brand" href="#">Leben lernen</a>
      <nav aria-label="Main navigation">
        ${navButton("practice", "Practice")}
        ${navButton("language", "Language")}
        ${navButton("mock", "Mock exam")}
      </nav>
      <div class="header-tools">
        <label class="region"><span>Region</span><select aria-label="Region">${catalog.regions.map((region) => `<option value="${escapeHtml(region.id)}" ${region.id === selectedRegion ? "selected" : ""}>${escapeHtml(region.label)}</option>`).join("")}</select></label>
        <label class="language"><span>Translation</span><select aria-label="Translation language">${catalog.supportLocales.map((locale) => `<option value="${escapeHtml(locale.id)}" ${locale.id === selectedSupportLocale ? "selected" : ""}>${escapeHtml(locale.label)}</option>`).join("")}</select></label>
        <div class="progress-label"><strong>${session.summary.answered}</strong> of ${session.summary.totalQuestions}</div>
      </div>
    </header>
    <main class="shell">
      <aside class="sidebar">
        <section><h2>Dashboard</h2><ol class="topic-list">
          <li class="current"><span>1</span><div><strong>Exam knowledge</strong><small>${session.summary.percentCorrect}% current score</small></div></li>
          <li><span>2</span><div><strong>German-only</strong><small>${session.summary.germanOnlyCorrect} correct without support</small></div></li>
          <li><span>3</span><div><strong>Words and patterns</strong><small>${currentLanguageExercises().length} drills</small></div></li>
        </ol></section>
        <button class="side-link" data-mode="language"><span><strong>Language practice</strong><small>Vocabulary and structure</small></span><b>&rsaquo;</b></button>
        <button class="side-link" data-mode="mock"><span><strong>${escapeHtml(currentRegionLabel())} mock</strong><small>${catalog.mockExam.generalQuestionCount + catalog.mockExam.regionalQuestionCount} exam questions</small></span><b>&rsaquo;</b></button>
      </aside>
      ${content}
    </main>`;
}

function renderPracticeToolbar(session: PracticeSession): string {
  if (customPracticeLabel) {
    return `
      <div class="practice-toolbar">
        <span><strong>${escapeHtml(customPracticeLabel)}</strong></span>
        <button class="secondary compact-button" id="clear-custom-practice">Back to practice sets</button>
      </div>
    `;
  }

  return `
    <div class="practice-toolbar">
      <label><span>Practice set</span><select aria-label="Practice set">
        ${practiceSetOption("all", "All questions")}
        ${practiceSetOption("unseen", "Unseen")}
        ${practiceSetOption("wrong", "Wrong answers")}
        ${practiceSetOption("bookmarked", "Bookmarked")}
        ${practiceSetOption("region", `${currentRegionLabel()} only`)}
      </select></label>
      <span>${session.summary.totalQuestions} questions</span>
    </div>
  `;
}

function renderMockHeader(session: PracticeSession): string {
  return `
    <div class="mock-header">
      <span>Mock exam</span>
      <strong>${formatRemainingTime()}</strong>
      <span>${session.summary.answered}/${session.summary.totalQuestions} answered</span>
    </div>
  `;
}

function renderMockPanel(session: PracticeSession): string {
  return `
    <aside class="support">
      <section><h2>Timer</h2><p class="answer-translation">${formatRemainingTime()}</p></section>
      <section><h2>Passing score</h2><p>${catalog.mockExam.passScore} correct answers are needed to pass.</p></section>
      <section><h2>Exam mode</h2><p>No translation, explanation, or answer feedback is shown until the final result.</p></section>
      <section><h2>Question mix</h2><p>${catalog.mockExam.generalQuestionCount} general questions + ${catalog.mockExam.regionalQuestionCount} ${escapeHtml(currentRegionLabel())} questions.</p></section>
      <section><h2>Progress</h2><p>${session.summary.answered} of ${session.summary.totalQuestions} answered.</p></section>
      ${renderWeakAreasSection()}
      ${renderMockHistorySection()}
    </aside>`;
}

function renderWeakAreasSection(): string {
  const weakTopics = currentWeakTopics().slice(0, 3);
  return `
    <section>
      <h2>Weak areas</h2>
      ${weakTopics.length > 0 ? `<ol class="weak-topic-list">${weakTopics.map(renderWeakTopic).join("")}</ol><button class="secondary compact-button full-width" id="practice-weakest-topic">Practice weakest topic</button>` : "<p>Complete a mock exam to see weak topics here.</p>"}
    </section>
  `;
}

function renderWeakTopic(topic: WeakTopicSummary): string {
  return `
    <li>
      <strong>${escapeHtml(topicLabel(topic.topic))}</strong>
      <span>${topic.wrongCount} missed answer${topic.wrongCount === 1 ? "" : "s"} · ${topic.questionIds.length} question${topic.questionIds.length === 1 ? "" : "s"}</span>
    </li>
  `;
}

function renderMockHistorySection(): string {
  const attempts = progress.mockExamAttempts.slice(0, 5);
  return `
    <section>
      <h2>Mock history</h2>
      ${attempts.length > 0 ? `<ol class="mock-history">${attempts.map(renderMockAttempt).join("")}</ol>` : "<p>No saved mock attempts yet.</p>"}
    </section>
  `;
}

function renderMockAttempt(attempt: MockExamAttempt): string {
  return `
    <li>
      <strong>${attempt.correct}/${attempt.totalQuestions}</strong>
      <span>${attempt.passed ? "Passed" : "Not passed"} · ${escapeHtml(regionLabel(attempt.region))}</span>
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
        <summary>Study support</summary>
        <div class="support-content">
          <section><h2>Translated answer</h2><p class="answer-translation" ${supportTextAttributes()}>${escapeHtml(support?.correctAnswerTranslation ?? "Answer support is not available yet.")}</p></section>
          <section><h2>Explanation</h2><p ${supportTextAttributes()}>${escapeHtml(support?.simpleExplanation ?? "Support is not available yet.")}</p></section>
          <section><h2>Key words</h2><dl>${support?.vocabulary.map((item) => `<div><dt lang="de" dir="ltr">${escapeHtml(item.source)}</dt><dd ${supportTextAttributes()}>${escapeHtml(item.translation)}</dd></div>`).join("") ?? ""}</dl></section>
          ${support?.germanPattern ? `<section><h2>German pattern</h2><p><strong lang="de" dir="ltr">${escapeHtml(support.germanPattern.pattern)}</strong><br><span ${supportTextAttributes()}>${escapeHtml(support.germanPattern.meaning)}</span></p></section>` : ""}
        </div>
      </details>
    </aside>`;
}

function bindShell(): void {
  app.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => button.addEventListener("click", () => {
    mode = button.dataset.mode as PracticeMode;
    if (mode === "mock") mockSession ??= createMockSession();
    if (mode !== "practice") customPracticeLabel = undefined;
    selected = undefined;
    checked = false;
    render();
  }));
  app.querySelector<HTMLSelectElement>('select[aria-label="Region"]')?.addEventListener("change", (event) => {
    selectedRegion = (event.currentTarget as HTMLSelectElement).value;
    customPracticeLabel = undefined;
    resetPracticeSession();
    mockSession = undefined;
    mockDeadlineAt = 0;
    selected = undefined;
    checked = false;
    usedSupportForQuestion = showSupport;
    render();
  });
  app.querySelector<HTMLSelectElement>('select[aria-label="Translation language"]')?.addEventListener("change", (event) => {
    selectedSupportLocale = (event.currentTarget as HTMLSelectElement).value;
    languageIndex = Math.min(languageIndex, Math.max(currentLanguageExercises().length - 1, 0));
    languageRevealed = false;
    usedSupportForQuestion = usedSupportForQuestion || showSupport;
    render();
  });
  app.querySelector<HTMLSelectElement>('select[aria-label="Practice set"]')?.addEventListener("change", (event) => {
    selectedPracticeSet = (event.currentTarget as HTMLSelectElement).value as PracticeSet;
    customPracticeLabel = undefined;
    resetPracticeSession();
    selected = undefined;
    checked = false;
    usedSupportForQuestion = showSupport;
    render();
  });
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
    startCustomPractice(`${topicLabel(weakestTopic.topic)} weak area`, weakestTopic.questionIds);
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
    setActiveSession({ ...session, currentIndex: session.currentIndex - 1 });
    selected = undefined;
    checked = false;
    usedSupportForQuestion = showSupport;
    render();
  });
  app.querySelector<HTMLButtonElement>("#check")?.addEventListener("click", () => {
    if (!selected) return;
    if (mode === "mock") {
      answerMockQuestion(selected);
      return;
    }
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
    render();
  });
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
  selected = undefined;
  checked = false;
  usedSupportForQuestion = false;
  render();
}

function bindLanguage(exercise: LanguageExercise): void {
  app.querySelector<HTMLButtonElement>("#language-previous")?.addEventListener("click", () => {
    languageIndex = Math.max(languageIndex - 1, 0);
    languageRevealed = false;
    render();
  });
  app.querySelector<HTMLButtonElement>("#reveal")?.addEventListener("click", () => {
    languageRevealed = !languageRevealed;
    render();
  });
  app.querySelector<HTMLButtonElement>("#known")?.addEventListener("click", () => {
    progress = {
      ...progress,
      updatedAt: new Date().toISOString(),
      vocabularyMastery: {
        ...progress.vocabularyMastery,
        [exercise.id]: Math.min((progress.vocabularyMastery[exercise.id] ?? MIN_MASTERY) + VOCABULARY_STEP, MAX_MASTERY)
      }
    };
    saveProgress(progress);
    languageIndex = Math.min(languageIndex + 1, currentLanguageExercises().length - 1);
    languageRevealed = false;
    render();
  });
}

function navButton(value: PracticeMode, label: string): string {
  return `<button class="nav-item ${mode === value ? "active" : ""}" data-mode="${value}">${label}</button>`;
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
  mode = "practice";
  customPracticeLabel = label;
  practiceSession = createPracticeSession(questionIds);
  selected = undefined;
  checked = false;
  usedSupportForQuestion = showSupport;
  render();
}

function createMockSession(): PracticeSession {
  mockStartedAt = new Date().toISOString();
  mockAttemptSaved = false;
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
  render();
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
    render();
  }, MILLISECONDS_PER_SECOND);
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
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
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
  const bundle = await createFetchCatalogLoader().loadBundle();
  catalog = bundle.catalog;
  supportPacks = bundle.supportPacks;
  engine = createPracticeEngine(catalog.questions, getAllSupportPacks(supportPacks));
  progress = loadProgress();
  selectedRegion = catalog.defaultRegion;
  selectedSupportLocale = catalog.supportLocales[0]?.id ?? "";
  resetPracticeSession();
  render();
}

start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  app.innerHTML = `<main class="loading-state error"><h1>Could not load practice data</h1><p>${escapeHtml(message)}</p></main>`;
});

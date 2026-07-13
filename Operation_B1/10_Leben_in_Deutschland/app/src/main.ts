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
  getCatalogQuestionIds,
  hydratePracticeSession,
  moveToNextQuestion,
  recordSessionAnswer
} from "./domain/practice-engine";
import type { PracticeEngine } from "./domain/practice-engine";
import type {
  ChoiceId,
  ExamCatalog,
  LanguageExercise,
  LearningSupport,
  PracticeMode,
  PracticeSession,
  ProgressSnapshot,
  QuestionId,
  SourceQuestion
} from "./domain/types";

const PROGRESS_STORAGE_KEY = "leben-lernen-progress-v1";
const VOCABULARY_STEP = 25;
const MAX_MASTERY = 100;
const MIN_MASTERY = 0;
const PUBLIC_BASE_URL = import.meta.env.BASE_URL;

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
let practiceSession: PracticeSession;
let mockSession: PracticeSession | undefined;
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
  mockSession ??= createPracticeSession(createMockExamQuestionIds(catalog, {
    region: selectedRegion,
    seed: Date.now()
  }));
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
  if (mode === "language") {
    renderLanguagePractice();
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
  const result = selected && checked
    ? engine.checkAnswer(question.id, selected, { usedSupport: usedSupportForQuestion })
    : undefined;
  const progressPercent = Math.round((session.summary.answered / session.summary.totalQuestions) * MAX_MASTERY);

  app.innerHTML = layout(`
    <section class="question-area">
      <div class="score-strip" aria-label="Session score">
        ${metric("Score", `${session.summary.percentCorrect}%`)}
        ${metric("Correct", `${session.summary.correct}/${session.summary.answered}`)}
        ${metric("German only", `${session.summary.germanOnlyCorrect}`)}
        ${metric("Assisted", `${session.summary.assisted}`)}
      </div>
      <div class="question-meta"><span>Question ${session.currentIndex + 1}</span><label class="toggle"><span>Show ${escapeHtml(currentSupportLocaleLabel())}</span><input type="checkbox" ${showSupport ? "checked" : ""}><i></i></label></div>
      <h1 lang="de">${escapeHtml(question.prompt)}</h1>
      ${showSupport && support ? `<p class="inline-translation">${escapeHtml(support.translation)}</p>` : ""}
      ${question.image ? `<figure class="catalog-figure"><img src="${escapeHtml(publicAssetPath(`catalog-pages/${question.image}.png`))}" alt="Official BAMF catalog visual for ${escapeHtml(question.id)}"></figure>` : ""}
      <fieldset><legend class="sr-only">Choose one answer</legend>${question.choices.map((choice) => {
        const isSelected = selected === choice.id;
        const state = checked ? choice.id === question.correctChoiceId ? " correct" : isSelected ? " wrong" : "" : "";
        return `<label class="answer${isSelected ? " selected" : ""}${state}"><input type="radio" name="answer" value="${choice.id}" ${isSelected ? "checked" : ""}><span class="radio"></span><span lang="de">${escapeHtml(choice.text)}</span></label>`;
      }).join("")}</fieldset>
      ${result ? `<div class="feedback ${result.isCorrect ? "success" : "error"}" role="status"><strong>${result.isCorrect ? "Correct" : "Not quite"}</strong>${support ? `<span>${escapeHtml(currentSupportLocaleLabel())} answer: ${escapeHtml(support.correctAnswerTranslation)}</span>` : ""}<span>${escapeHtml(support?.simpleExplanation ?? "Review the correct answer.")}</span></div>` : ""}
      <div class="actions"><button class="secondary" id="previous" ${session.currentIndex === 0 ? "disabled" : ""}>Previous</button><button class="primary" id="check" ${selected ? "" : "disabled"}>${checked ? session.summary.isComplete ? "See results" : "Next question" : "Check answer"}</button></div>
      <div class="progress-note"><span class="progress-track"><i style="width:${progressPercent}%"></i></span><span>${session.summary.answered} answered in this set</span></div>
    </section>
    ${renderSupportPanel(question.id)}
  `);

  bindShell();
  bindQuestion();
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
        practiceSession = createPracticeSession(getCatalogQuestionIds(catalog, { region: selectedRegion }));
      }
    selected = undefined;
    checked = false;
    usedSupportForQuestion = showSupport;
    render();
  });
  app.querySelector<HTMLButtonElement>("#reset-progress")?.addEventListener("click", () => {
    progress = createProgressSnapshot();
    saveProgress(progress);
    practiceSession = createPracticeSession(getCatalogQuestionIds(catalog, { region: selectedRegion }));
    selected = undefined;
    checked = false;
    usedSupportForQuestion = showSupport;
    render();
  });
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
        <span>${languageRevealed ? escapeHtml(exercise.answer) : "Think first, then reveal."}</span>
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
        <label class="language"><span>Support</span><select aria-label="Support language">${catalog.supportLocales.map((locale) => `<option value="${escapeHtml(locale.id)}" ${locale.id === selectedSupportLocale ? "selected" : ""}>${escapeHtml(locale.label)}</option>`).join("")}</select></label>
        <div class="progress-label"><strong>${session.summary.answered}</strong> of ${getCatalogQuestionIds(catalog, { region: selectedRegion }).length}</div>
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

function renderSupportPanel(questionId: QuestionId): string {
  const { support } = engine.getLearningItem(questionId, selectedSupportLocale);
  return `
    <aside class="support ${showSupport ? "" : "hidden"}">
      <section><h2>${escapeHtml(currentSupportLocaleLabel())} answer first</h2><p class="answer-translation">${escapeHtml(support?.correctAnswerTranslation ?? "Answer support is not available yet.")}</p></section>
      <section><h2>Simple explanation</h2><p>${escapeHtml(support?.simpleExplanation ?? "Support is not available yet.")}</p></section>
      <section><h2>Key words</h2><dl>${support?.vocabulary.map((item) => `<div><dt lang="de">${escapeHtml(item.source)}</dt><dd>${escapeHtml(item.translation)}</dd></div>`).join("") ?? ""}</dl></section>
      ${support?.germanPattern ? `<section><h2>German pattern</h2><p><strong lang="de">${escapeHtml(support.germanPattern.pattern)}</strong><br><span>${escapeHtml(support.germanPattern.meaning)}</span></p></section>` : ""}
    </aside>`;
}

function bindShell(): void {
  app.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => button.addEventListener("click", () => {
    mode = button.dataset.mode as PracticeMode;
    if (mode === "mock") mockSession ??= createPracticeSession(createMockExamQuestionIds(catalog, {
      region: selectedRegion,
      seed: Date.now()
    }));
    selected = undefined;
    checked = false;
    render();
  }));
  app.querySelector<HTMLSelectElement>('select[aria-label="Region"]')?.addEventListener("change", (event) => {
    selectedRegion = (event.currentTarget as HTMLSelectElement).value;
    practiceSession = hydratePracticeSession(getCatalogQuestionIds(catalog, { region: selectedRegion }), progress.answers);
    mockSession = undefined;
    selected = undefined;
    checked = false;
    usedSupportForQuestion = showSupport;
    render();
  });
  app.querySelector<HTMLSelectElement>('select[aria-label="Support language"]')?.addEventListener("change", (event) => {
    selectedSupportLocale = (event.currentTarget as HTMLSelectElement).value;
    languageIndex = Math.min(languageIndex, Math.max(currentLanguageExercises().length - 1, 0));
    languageRevealed = false;
    usedSupportForQuestion = usedSupportForQuestion || showSupport;
    render();
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
      if (mode !== "mock") {
        progress = {
          ...progress,
          updatedAt: new Date().toISOString(),
          answers: nextSession.answers
        };
        saveProgress(progress);
      }
    } else {
      setActiveSession(moveToNextQuestion(activeSession()));
      selected = undefined;
      checked = false;
      usedSupportForQuestion = showSupport;
    }
    render();
  });
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

function currentRegionLabel(): string {
  return catalog.regions.find((region) => region.id === selectedRegion)?.label ?? selectedRegion;
}

function currentSupportLocaleLabel(): string {
  return catalog.supportLocales.find((locale) => locale.id === selectedSupportLocale)?.label ?? selectedSupportLocale;
}

function currentLanguageExercises(): readonly LanguageExercise[] {
  return createLanguageExercises(getSupportPack(supportPacks, selectedSupportLocale));
}

function publicAssetPath(path: string): string {
  return `${PUBLIC_BASE_URL}${path.replace(/^\/+/u, "")}`;
}

function loadProgress(): ProgressSnapshot {
  const fallback: ProgressSnapshot = {
    version: 1,
    updatedAt: new Date().toISOString(),
    answers: [],
    vocabularyMastery: {}
  };
  const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as ProgressSnapshot;
    return parsed.version === 1 ? parsed : fallback;
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
    vocabularyMastery: {}
  };
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
  practiceSession = hydratePracticeSession(getCatalogQuestionIds(catalog, { region: selectedRegion }), progress.answers);
  render();
}

start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  app.innerHTML = `<main class="loading-state error"><h1>Could not load practice data</h1><p>${escapeHtml(message)}</p></main>`;
});

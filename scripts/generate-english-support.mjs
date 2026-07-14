import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const dataRoot = path.join(appRoot, "public", "data", "exams", "leben-in-deutschland");
const generalQuestionsJsonPath = path.join(dataRoot, "questions.de.json");
const bavariaQuestionsJsonPath = path.join(dataRoot, "regions", "bavaria.de.json");
const supportRoot = path.join(dataRoot, "support");
const supportJsonPath = path.join(supportRoot, "en.json");

const MANUAL_SUPPORT = new Map([
  [
    "general-1",
    {
      translation: "In Germany, people may openly say something against the government because ...",
      correctAnswerTranslation: "freedom of expression applies here",
      simpleExplanation: "People may openly criticise the government because freedom of expression is protected.",
      vocabulary: [
        { source: "dürfen", translation: "may / are allowed to" },
        { source: "die Regierung", translation: "the government" },
        { source: "Meinungsfreiheit", translation: "freedom of expression" }
      ],
      germanPattern: { pattern: "etwas gegen ... sagen", meaning: "to say something against ..." }
    }
  ],
  [
    "general-2",
    {
      translation: "Until their child is 14, parents in Germany can decide whether the child attends ... at school.",
      correctAnswerTranslation: "religious education",
      simpleExplanation: "Parents decide about participation in religious education until the child turns 14.",
      vocabulary: [
        { source: "entscheiden", translation: "to decide" },
        { source: "teilnehmen", translation: "to participate" },
        { source: "Religionsunterricht", translation: "religious education" }
      ]
    }
  ],
  [
    "general-3",
    {
      translation: "Germany is governed by the rule of law. What does that mean?",
      correctAnswerTranslation: "All residents and the state must obey the laws.",
      simpleExplanation: "Everyone, including the state, must obey the law.",
      vocabulary: [
        { source: "der Rechtsstaat", translation: "state governed by the rule of law" },
        { source: "sich an Gesetze halten", translation: "to obey laws" }
      ]
    }
  ],
  [
    "general-4",
    {
      translation: "Which right is one of the fundamental rights in Germany?",
      correctAnswerTranslation: "freedom of expression",
      simpleExplanation: "Freedom of expression is protected as a fundamental right.",
      vocabulary: [
        { source: "das Grundrecht", translation: "fundamental right" },
        { source: "gehört zu", translation: "belongs to / is one of" }
      ]
    }
  ],
  [
    "general-6",
    {
      translation: "What is the German constitution called?",
      correctAnswerTranslation: "Basic Law",
      simpleExplanation: "Germany's constitution is called the Grundgesetz, the Basic Law.",
      vocabulary: [
        { source: "die Verfassung", translation: "the constitution" },
        { source: "heißen", translation: "to be called" },
        { source: "das Grundgesetz", translation: "the Basic Law" }
      ]
    }
  ],
  [
    "bavaria-2",
    {
      translation: "Which of these is a district in Bavaria?",
      correctAnswerTranslation: "Altötting",
      simpleExplanation: "Altötting is a Landkreis, a rural district, in Upper Bavaria.",
      vocabulary: [
        { source: "der Landkreis", translation: "rural district / county" },
        { source: "Bayern", translation: "Bavaria" }
      ]
    }
  ],
  [
    "bavaria-7",
    {
      translation: "The capital of Bavaria is called ...",
      correctAnswerTranslation: "Munich",
      simpleExplanation: "Munich, München in German, is the capital of Bavaria.",
      vocabulary: [
        { source: "die Landeshauptstadt", translation: "state capital" },
        { source: "heißt", translation: "is called" },
        { source: "München", translation: "Munich" }
      ]
    }
  ]
]);

const TERM_GLOSSARY = [
  ["Abgeordnete", "members of parliament / representatives"],
  ["abschaffen", "to abolish"],
  ["Alter", "age"],
  ["Arbeit", "work"],
  ["Arbeitnehmer", "employee"],
  ["Arbeitslosenversicherung", "unemployment insurance"],
  ["Arzt", "doctor"],
  ["Asyl", "asylum"],
  ["Aufgabe", "task / question"],
  ["Außenministerin/Außenminister", "foreign minister"],
  ["Bayern", "Bavaria"],
  ["Behörde", "authority / government office"],
  ["bei Kommunalwahlen", "in municipal elections"],
  ["Betriebsrat", "works council"],
  ["Bevölkerung", "population"],
  ["Bundeskanzlerin/Bundeskanzler", "Federal Chancellor"],
  ["Bundesland", "federal state"],
  ["Bundesländer", "federal states"],
  ["Bundespräsident", "Federal President"],
  ["Bundesrat", "Federal Council"],
  ["Bundesregierung", "federal government"],
  ["Bundesrepublik Deutschland", "Federal Republic of Germany"],
  ["Bundestag", "German federal parliament"],
  ["DDR", "East Germany / German Democratic Republic"],
  ["Demokratie", "democracy"],
  ["Deutschland", "Germany"],
  ["deutsche Verfassung", "German constitution"],
  ["die Würde des Menschen", "human dignity"],
  ["Diktatur", "dictatorship"],
  ["dürfen", "may / are allowed to"],
  ["Ehe", "marriage"],
  ["Einwohnerinnen/Einwohner", "residents"],
  ["Eltern", "parents"],
  ["Erwerbstätigen", "employed people"],
  ["Europäische Union", "European Union"],
  ["Familie", "family"],
  ["Finanzministerin/Finanzminister", "finance minister"],
  ["Flagge", "flag"],
  ["Folter", "torture"],
  ["frei", "free"],
  ["Freiheit", "freedom"],
  ["Freistaat Bayern", "Free State of Bavaria"],
  ["Friedliche Revolution", "Peaceful Revolution"],
  ["Gemeinde", "municipality"],
  ["Gericht", "court"],
  ["Gesetz", "law"],
  ["gesetzliche Rentenversicherung", "statutory pension insurance"],
  ["gesetzliche Sozialversicherung", "statutory social insurance"],
  ["Glaubensfreiheit", "freedom of belief"],
  ["Grundgesetz", "Basic Law"],
  ["Grundrecht", "fundamental right"],
  ["heißt", "is called"],
  ["Innenministerin/Innenminister", "interior minister"],
  ["Justizministerin/Justizminister", "justice minister"],
  ["Kandidatin/einen Kandidaten", "a candidate"],
  ["Kind", "child"],
  ["Kirchen", "churches"],
  ["Kommunalwahlen", "municipal elections"],
  ["Krankenversicherung", "health insurance"],
  ["Landeshauptstadt", "state capital"],
  ["Landesflagge", "state flag"],
  ["Landeszentrale für politische Bildung", "state agency for civic education"],
  ["Landkreis", "rural district / county"],
  ["Landtag", "state parliament"],
  ["Meinung", "opinion"],
  ["Meinungsfreiheit", "freedom of expression"],
  ["Menschenwürde", "human dignity"],
  ["Ministerpräsidentin/Ministerpräsident", "state premier / minister-president"],
  ["München", "Munich"],
  ["Nationalsozialismus", "National Socialism / Nazism"],
  ["Opposition", "opposition"],
  ["Parlament", "parliament"],
  ["Partei", "political party"],
  ["Pflegeversicherung", "long-term care insurance"],
  ["Pressefreiheit", "freedom of the press"],
  ["Rechtsstaat", "state governed by the rule of law"],
  ["Regierung", "government"],
  ["Religionsfreiheit", "freedom of religion"],
  ["Religionsunterricht", "religious education"],
  ["Republik", "republic"],
  ["Rentenversicherung", "pension insurance"],
  ["Schule", "school"],
  ["Sozialversicherung", "social insurance"],
  ["Staat", "state"],
  ["Staatsangehörigkeit", "citizenship / nationality"],
  ["Steuern", "taxes"],
  ["Todesstrafe", "death penalty"],
  ["Verbraucherzentrale", "consumer advice centre"],
  ["Verfassung", "constitution"],
  ["verfassungswidrig", "unconstitutional"],
  ["Volk", "people / nation"],
  ["Wahl", "election"],
  ["Wahlrecht", "right to vote"],
  ["wählen", "to vote / choose"],
  ["Wappen", "coat of arms"],
  ["Wiedervereinigung", "reunification"],
  ["Zweiter Weltkrieg", "Second World War"]
];

const PATTERNS = [
  [/^Wie heißt /, { pattern: "Wie heißt ...?", meaning: "What is ... called?" }],
  [/^Wie nennt man /, { pattern: "Wie nennt man ...?", meaning: "What do you call ...?" }],
  [/^Was bedeutet /, { pattern: "Was bedeutet ...?", meaning: "What does ... mean?" }],
  [/^Was ist /, { pattern: "Was ist ...?", meaning: "What is ...?" }],
  [/^Was gehört /, { pattern: "Was gehört ...?", meaning: "What belongs to ...?" }],
  [/^Was versteht man unter /, { pattern: "Was versteht man unter ...?", meaning: "What is understood by ...?" }],
  [/^Welche /, { pattern: "Welche ...?", meaning: "Which ...? (feminine/plural)" }],
  [/^Welcher /, { pattern: "Welcher ...?", meaning: "Which ...? (masculine)" }],
  [/^Welches /, { pattern: "Welches ...?", meaning: "Which ...? (neuter)" }],
  [/^Wo /, { pattern: "Wo ...?", meaning: "Where ...?" }],
  [/^Wann /, { pattern: "Wann ...?", meaning: "When ...?" }],
  [/^Ab welchem Alter /, { pattern: "Ab welchem Alter ...?", meaning: "From what age ...?" }],
  [/^Für wie viele Jahre /, { pattern: "Für wie viele Jahre ...?", meaning: "For how many years ...?" }]
];

const ANSWER_TRANSLATIONS = new Map([
  ["Bild 1", "Image 1"],
  ["Bild 2", "Image 2"],
  ["Bild 3", "Image 3"],
  ["Bild 4", "Image 4"],
  ["Grundgesetz", "Basic Law"],
  ["Meinungsfreiheit", "freedom of expression"],
  ["Religionsunterricht teilnimmt.", "attends religious education"],
  ["Glaubens- und Gewissensfreiheit", "freedom of belief and conscience"],
  ["Asyl", "asylum"],
  ["die Geldstrafe", "a fine"],
  ["Ministerpräsidentin/Ministerpräsident", "state premier / minister-president"],
  ["Außenministerin/Außenminister", "foreign minister"],
  ["München.", "Munich"],
  ["Altötting", "Altötting"],
  ["weiß-blau", "white and blue"],
  ["bei der Landeszentrale für politische Bildung", "at the State Agency for Civic Education"],
  ["18", "18"],
  ["5", "5"],
  ["4", "4"]
]);

const questions = readQuestions();
const support = questions.map((question) => {
  const manual = MANUAL_SUPPORT.get(question.id);
  if (manual) return withRequiredFields(question.id, manual);
  return generatedSupport(question);
});

fs.mkdirSync(supportRoot, { recursive: true });
fs.writeFileSync(supportJsonPath, `${JSON.stringify(support, null, 2)}\n`);
console.log(`Generated English support for ${support.length} questions`);
console.log(`Wrote static support data to ${path.relative(process.cwd(), supportJsonPath)}`);

function readQuestions() {
  if (!fs.existsSync(generalQuestionsJsonPath) || !fs.existsSync(bavariaQuestionsJsonPath)) {
    throw new Error("Question JSON files are missing. Run scripts/import-bamf-catalog.mjs first.");
  }

  return [
    ...JSON.parse(fs.readFileSync(generalQuestionsJsonPath, "utf8")),
    ...JSON.parse(fs.readFileSync(bavariaQuestionsJsonPath, "utf8"))
  ];
}

function generatedSupport(question) {
  const correctChoice = question.choices.find((choice) => choice.id === question.correctChoiceId);
  if (!correctChoice) throw new Error(`Missing correct choice for ${question.id}`);

  const vocabulary = extractVocabulary(`${question.prompt} ${correctChoice.text}`);
  const correctAnswerTranslation = translateAnswer(correctChoice.text, vocabulary);
  const meaningList = vocabulary.map((item) => `${item.source} = ${item.translation}`).join("; ");
  const translation = meaningList
    ? `English study guide: ${meaningList}.`
    : `English study guide: focus on the question wording and the correct answer.`;
  const simpleExplanation = `Correct answer: ${stripTrailingSentencePunctuation(correctChoice.text)}. Use the key words to understand why this option fits the German question.`;
  const germanPattern = inferPattern(question.prompt);

  return {
    questionId: question.id,
    locale: "en",
    translation,
    correctAnswerTranslation,
    simpleExplanation,
    vocabulary,
    ...(germanPattern ? { germanPattern } : {})
  };
}

function withRequiredFields(questionId, support) {
  return {
    questionId,
    locale: "en",
    translation: support.translation,
    correctAnswerTranslation: support.correctAnswerTranslation,
    simpleExplanation: support.simpleExplanation,
    vocabulary: support.vocabulary,
    ...(support.germanPattern ? { germanPattern: support.germanPattern } : {})
  };
}

function extractVocabulary(text) {
  const normalizedText = normalize(text);
  const seen = new Set();
  const vocabulary = [];
  const matches = TERM_GLOSSARY
    .filter(([source]) => normalizedText.includes(normalize(source)))
    .sort(([left], [right]) => right.length - left.length);

  for (const [source, translation] of matches) {
    if (seen.has(source)) continue;
    if (vocabulary.some((item) => normalize(item.source).includes(normalize(source)))) continue;
    seen.add(source);
    vocabulary.push({ source, translation });
    if (vocabulary.length >= 6) break;
  }
  if (vocabulary.length === 0) {
    vocabulary.push(...fallbackVocabulary(text));
  }
  return vocabulary;
}

function fallbackVocabulary(text) {
  return text
    .split(/[\s,.;:!?()[\]"„“]+/)
    .filter((word) => word.length >= 7)
    .slice(0, 3)
    .map((word) => ({ source: word, translation: "review this key German word" }));
}

function inferPattern(prompt) {
  const match = PATTERNS.find(([pattern]) => pattern.test(prompt));
  return match?.[1];
}

function translateAnswer(answer, vocabulary) {
  const exact = ANSWER_TRANSLATIONS.get(answer);
  if (exact) return exact;

  let translated = answer;
  const replacements = [...vocabulary].sort((left, right) => right.source.length - left.source.length);
  for (const item of replacements) {
    translated = replaceCaseInsensitive(translated, item.source, item.translation);
  }

  return translated === answer
    ? `English guide: ${stripTrailingSentencePunctuation(answer)}`
    : stripTrailingSentencePunctuation(translated);
}

function replaceCaseInsensitive(value, search, replacement) {
  return value.replace(new RegExp(escapeRegExp(search), "gi"), replacement);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalize(value) {
  return value.toLocaleLowerCase("de-DE").replace(/\s+/g, " ").trim();
}

function stripTrailingSentencePunctuation(value) {
  return value.replace(/[.。]\s*$/u, "");
}

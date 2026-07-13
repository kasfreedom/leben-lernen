import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CHOICE_IDS = ["a", "b", "c", "d"];
const GENERAL_COUNT = 300;
const BAVARIA_COUNT = 10;
const TARGET_COUNT = GENERAL_COUNT + BAVARIA_COUNT;
const ANSWER_KEY_DATE = "2026-07-13";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");
const appRoot = path.resolve(__dirname, "..");
const rawTextPath = path.join(projectRoot, "data", "catalog_raw_text.txt");
const answerKeyPath = path.join(projectRoot, "data", `oet_bavaria_answer_keys_${ANSWER_KEY_DATE}.json`);
const dataRoot = path.join(appRoot, "public", "data", "exams", "leben-in-deutschland");
const manifestPath = path.join(dataRoot, "manifest.json");
const generalQuestionsPath = path.join(dataRoot, "questions.de.json");
const regionsRoot = path.join(dataRoot, "regions");
const bavariaQuestionsPath = path.join(regionsRoot, "bavaria.de.json");

const rawText = fs.readFileSync(rawTextPath, "utf8").replace(/\f/g, "\n");
const answerKeys = JSON.parse(fs.readFileSync(answerKeyPath, "utf8"));

const generalSegment = between(rawText, "Teil I", "Fragen für das Bundesland Baden-Württemberg");
const bavariaSegment = between(rawText, "Fragen für das Bundesland Bayern", "Fragen für das Bundesland Berlin");

const generalQuestions = parseSegment(generalSegment, "general", 0);
const bavariaQuestions = parseSegment(bavariaSegment, "bavaria", GENERAL_COUNT);
const questions = [...generalQuestions, ...bavariaQuestions].map((question, index) =>
  attachCorrectChoice(question, answerKeys[index], index + 1)
);

validateQuestions(questions);
fs.mkdirSync(regionsRoot, { recursive: true });
fs.writeFileSync(manifestPath, renderJson(createManifest()));
fs.writeFileSync(generalQuestionsPath, renderJson(generalQuestions.map((question, index) =>
  attachCorrectChoice(question, answerKeys[index], index + 1)
)));
fs.writeFileSync(bavariaQuestionsPath, renderJson(questions.filter((question) => question.region === "bavaria")));

console.log(`Wrote static data to ${path.relative(process.cwd(), dataRoot)}`);

function between(text, startMarker, endMarker) {
  const startIndex = text.indexOf(startMarker);
  const endIndex = text.indexOf(endMarker, startIndex + startMarker.length);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`Could not find segment markers: ${startMarker} -> ${endMarker}`);
  }
  return text.slice(startIndex, endIndex);
}

function parseSegment(segment, region, offset) {
  const matches = [...segment.matchAll(/^Aufgabe\s+(\d+)\s*$/gm)];
  return matches.map((match, index) => {
    const nextMatch = matches[index + 1];
    const number = Number(match[1]);
    const body = segment.slice(match.index + match[0].length, nextMatch?.index ?? segment.length);
    const parsed = parseQuestionBody(body);
    return {
      id: `${region}-${number}`,
      sourceLocale: "de",
      region,
      topic: inferTopic(region, offset + number),
      prompt: parsed.prompt,
      choices: parsed.choices.map((text, choiceIndex) => ({
        id: CHOICE_IDS[choiceIndex],
        text
      })),
      correctChoiceId: "a",
      image: parsed.hasImage ? `catalog-page-question-${offset + number}` : undefined
    };
  });
}

function parseQuestionBody(body) {
  const hasImage = /Bild\s+1\s+Bild\s+2/.test(body) || /\S[^\n]*\n(?:\s*\n){3,}\s*[□]/.test(body);
  const lines = body
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((line) => line && !isPageFooter(line) && !isBildCaption(line) && !isSectionHeading(line));

  const choiceIndexes = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => isChoiceLine(line));

  if (choiceIndexes.length !== CHOICE_IDS.length) {
    throw new Error(`Expected 4 choices, found ${choiceIndexes.length}: ${lines.join(" | ")}`);
  }

  const promptLines = lines.slice(0, choiceIndexes[0].index);
  const choices = choiceIndexes.map(({ index }, choiceIndex) => {
    const nextChoice = choiceIndexes[choiceIndex + 1];
    return lines
      .slice(index, nextChoice?.index ?? lines.length)
      .map((line) => line.replace(/^[□]\s*/, ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  });

  const prompt = promptLines
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!prompt) throw new Error(`Missing prompt for choices: ${choices.join(" | ")}`);

  return {
    prompt,
    choices,
    hasImage
  };
}

function attachCorrectChoice(question, answerKey, expectedNumber) {
  if (!answerKey || answerKey.requestedNumber !== expectedNumber || answerKey.number !== expectedNumber) {
    throw new Error(`Answer key mismatch for question ${expectedNumber}`);
  }

  const correctIndex = question.choices.findIndex((choice) =>
    normalizeAnswer(choice.text) === normalizeAnswer(answerKey.correctText)
  );

  const correctRowIndex = answerKey.rows.findIndex((row) => row.isCorrect);
  if (correctRowIndex < 0 || answerKey.rows.length !== CHOICE_IDS.length) {
    throw new Error(`Invalid answer-key rows for ${question.id}`);
  }

  const resolvedIndex = correctIndex >= 0 ? correctIndex : correctRowIndex;

  if (resolvedIndex < 0) {
    throw new Error(
      `Could not match correct answer for ${question.id}: ${answerKey.correctText} in ${question.choices
        .map((choice) => choice.text)
        .join(" | ")}`
    );
  }

  return {
    ...question,
    correctChoiceId: CHOICE_IDS[resolvedIndex]
  };
}

function validateQuestions(parsedQuestions) {
  if (parsedQuestions.length !== TARGET_COUNT) {
    throw new Error(`Expected ${TARGET_COUNT} questions, got ${parsedQuestions.length}`);
  }
  const general = parsedQuestions.filter((question) => question.region === "general");
  const bavaria = parsedQuestions.filter((question) => question.region === "bavaria");
  if (general.length !== GENERAL_COUNT) throw new Error(`Expected ${GENERAL_COUNT} general questions`);
  if (bavaria.length !== BAVARIA_COUNT) throw new Error(`Expected ${BAVARIA_COUNT} Bavaria questions`);
  const ids = new Set(parsedQuestions.map((question) => question.id));
  if (ids.size !== parsedQuestions.length) throw new Error("Question IDs are not unique");
  for (const question of parsedQuestions) {
    if (question.choices.length !== CHOICE_IDS.length) throw new Error(`Invalid choice count: ${question.id}`);
    if (!CHOICE_IDS.includes(question.correctChoiceId)) throw new Error(`Invalid correct choice: ${question.id}`);
  }
}

function createManifest() {
  return {
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
    regions: [
      {
        id: "bavaria",
        label: "Bavaria",
        questionsPath: "regions/bavaria.de.json"
      }
    ],
    supportLocales: [
      {
        id: "en",
        label: "English",
        supportPath: "support/en.json"
      }
    ]
  };
}

function renderJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function cleanLine(line) {
  return line.replace(/\f/g, "").trim();
}

function isPageFooter(line) {
  return /^Seite\s+\d+\s+von\s+\d+$/.test(line);
}

function isBildCaption(line) {
  return /^Bild\s+1\s+Bild\s+2/.test(line);
}

function isSectionHeading(line) {
  return /^Teil\s+[IVX]+$/.test(line);
}

function isChoiceLine(line) {
  return /^[□]/.test(line);
}

function inferTopic(region, absoluteNumber) {
  if (region === "bavaria") return "bavaria";
  if (absoluteNumber <= 90) return "democracy";
  if (absoluteNumber <= 190) return "history";
  return "society";
}

function normalizeAnswer(value) {
  return value
    .replaceAll("…", "...")
    .replaceAll("‐", "-")
    .replaceAll("‑", "-")
    .replaceAll("–", "-")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .replace(/[.。]\s*$/u, "")
    .trim()
    .toLocaleLowerCase("de-DE");
}

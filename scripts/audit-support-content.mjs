import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const examRoot = path.join(appRoot, "public", "data", "exams", "leben-in-deutschland");
const manifestPath = path.join(examRoot, "manifest.json");
const generatedStudyGuidePattern = /English study guide|English guide|دليل دراسة|دليل الدراسة|دليل اللغة الإنجليزية/u;
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

let hasIssues = false;

for (const locale of manifest.supportLocales) {
  const supportPath = path.join(examRoot, locale.supportPath ?? `support/${locale.id}.json`);
  const support = JSON.parse(fs.readFileSync(supportPath, "utf8"));
  const invalid = support.filter((item) =>
    item.locale !== locale.id
    || !item.translation.trim()
    || !item.correctAnswerTranslation.trim()
    || !item.simpleExplanation.trim()
    || !Array.isArray(item.vocabulary)
    || item.vocabulary.length === 0
    || generatedStudyGuidePattern.test(item.translation)
    || generatedStudyGuidePattern.test(item.correctAnswerTranslation)
    || generatedStudyGuidePattern.test(item.simpleExplanation)
  );

  console.log(`${locale.id}: ${support.length - invalid.length}/${support.length} valid, ${invalid.length} need review`);
  if (invalid.length > 0) {
    hasIssues = true;
    console.log(`next: ${invalid.slice(0, 20).map((item) => item.questionId).join(", ")}`);
  }
}

if (hasIssues) process.exitCode = 1;

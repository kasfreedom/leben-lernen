import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const supportRoot = path.join(appRoot, "public", "data", "exams", "leben-in-deutschland", "support");
const generatedStudyGuidePattern = /English study guide|English guide|دليل دراسة|دليل الدراسة|دليل اللغة الإنجليزية/u;

let hasIssues = false;

for (const locale of ["en", "ar"]) {
  const supportPath = path.join(supportRoot, `${locale}.json`);
  const support = JSON.parse(fs.readFileSync(supportPath, "utf8"));
  const invalid = support.filter((item) =>
    generatedStudyGuidePattern.test(item.translation)
    || generatedStudyGuidePattern.test(item.correctAnswerTranslation)
    || generatedStudyGuidePattern.test(item.simpleExplanation)
  );

  console.log(`${locale}: ${support.length - invalid.length}/${support.length} reviewed, ${invalid.length} need review`);
  if (invalid.length > 0) {
    hasIssues = true;
    console.log(`next: ${invalid.slice(0, 20).map((item) => item.questionId).join(", ")}`);
  }
}

if (hasIssues) process.exitCode = 1;

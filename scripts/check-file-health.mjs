import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const budgets = [
  { file: "src/server/db/index.ts", maxLines: 300 },
  { file: "src/server/investigation/investigate.ts", maxLines: 220 },
  { file: "src/server/investigation/stages.ts", maxLines: 320 },
  { file: "src/server/ai/answers/grounded-answer.ts", maxLines: 260 },
  { file: "src/server/ai/answers/investigation-answer.ts", maxLines: 560 },
  { file: "components/AnswerPanel.tsx", maxLines: 560 },
];

const forbiddenServerRuntimePaths = [
  "lib/ai",
  "lib/answer.ts",
  "lib/db.ts",
  "lib/embed.ts",
  "lib/env.ts",
  "lib/ingest.ts",
  "lib/investigate.ts",
  "lib/investigation",
  "lib/log.ts",
  "lib/openai.ts",
  "lib/parse.ts",
  "lib/rerank.ts",
  "lib/retrieve.ts",
  "lib/sample-document.ts",
  "lib/session.ts",
  "lib/tools",
];

function countLines(contents) {
  if (!contents) {
    return 0;
  }
  return contents.split("\n").length;
}

const failures = [];
const forbiddenPathFailures = [];

for (const forbiddenPath of forbiddenServerRuntimePaths) {
  const fullPath = path.join(ROOT, forbiddenPath);

  if (fs.existsSync(fullPath)) {
    forbiddenPathFailures.push(forbiddenPath);
  }
}

for (const budget of budgets) {
  const fullPath = path.join(ROOT, budget.file);

  if (!fs.existsSync(fullPath)) {
    continue;
  }

  const contents = fs.readFileSync(fullPath, "utf8");
  const lines = countLines(contents);

  if (lines > budget.maxLines) {
    failures.push({
      ...budget,
      lines,
    });
  }
}

if (failures.length || forbiddenPathFailures.length) {
  console.error("File health check failed:");

  for (const failure of failures) {
    console.error(`- ${failure.file}: ${failure.lines} lines (max ${failure.maxLines})`);
  }

  for (const forbiddenPath of forbiddenPathFailures) {
    console.error(`- ${forbiddenPath}: server runtime code belongs under src/server`);
  }

  process.exit(1);
}

console.log("File health check passed.");

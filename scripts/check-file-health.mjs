import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const budgets = [
  { file: "lib/db.ts", maxLines: 300 },
  { file: "lib/investigate.ts", maxLines: 220 },
  { file: "lib/investigation/stages.ts", maxLines: 320 },
  { file: "lib/ai/grounded-answer.ts", maxLines: 260 },
  { file: "lib/ai/investigation-answer.ts", maxLines: 560 },
  { file: "components/AnswerPanel.tsx", maxLines: 560 },
];

function countLines(contents) {
  if (!contents) {
    return 0;
  }
  return contents.split("\n").length;
}

const failures = [];

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

if (failures.length) {
  console.error("File health check failed:");

  for (const failure of failures) {
    console.error(`- ${failure.file}: ${failure.lines} lines (max ${failure.maxLines})`);
  }

  process.exit(1);
}

console.log("File health check passed.");

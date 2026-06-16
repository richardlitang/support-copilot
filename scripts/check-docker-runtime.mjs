import { readFileSync } from "node:fs";

const dockerfile = readFileSync("Dockerfile", "utf8");

const requiredRunnerCopies = [
  {
    label: "worker source",
    pattern: /COPY\s+--from=builder\s+\/app\/src\s+\.\/src/,
  },
  {
    label: "shared lib source used by the worker",
    pattern: /COPY\s+--from=builder\s+\/app\/lib\s+\.\/lib/,
  },
  {
    label: "TypeScript path config",
    pattern: /COPY\s+--from=builder\s+\/app\/tsconfig\.json\s+\.\/tsconfig\.json/,
  },
];

const missingCopies = requiredRunnerCopies.filter(({ pattern }) => !pattern.test(dockerfile));

if (missingCopies.length > 0) {
  console.error(
    [
      "Docker runtime image is missing files required by npm run worker:start:",
      ...missingCopies.map(({ label }) => `- ${label}`),
    ].join("\n"),
  );
  process.exit(1);
}

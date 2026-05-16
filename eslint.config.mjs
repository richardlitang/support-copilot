import nextVitals from "eslint-config-next/core-web-vitals";
import prettierConfig from "eslint-config-prettier/flat";

const config = [
  {
    ignores: [
      ".next/**",
      "coverage/**",
      "dist/**",
      "build/**",
      "node_modules/**",
      "public/**",
      "uploads/**",
      "*.png",
      "*.pdf",
      "tsconfig.tsbuildinfo",
    ],
  },
  ...nextVitals,
  {
    files: ["components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/src/server/**"],
              message: "UI components must not import server infrastructure modules.",
            },
            {
              group: ["@/app/api/**"],
              message: "UI components must not import API route handlers.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/server/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/**"],
              message: "Server modules must not import UI components.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/server/investigation/graph/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/**", "@/app/**"],
              message: "Graph pipeline code must stay independent from app and UI layers.",
            },
          ],
        },
      ],
    },
  },
  prettierConfig,
];

export default config;

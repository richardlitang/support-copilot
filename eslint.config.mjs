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
  prettierConfig,
];

export default config;

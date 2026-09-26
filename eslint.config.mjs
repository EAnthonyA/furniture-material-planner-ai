import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [...nextCoreWebVitals, ...nextTypeScript];

eslintConfig.push({
  files: ["src/**/*.{ts,tsx}"],
  ignores: ["src/generated/**"],
  rules: {
    complexity: ["error", { max: 12, variant: "modified" }],
    "max-depth": ["error", 4],
    "max-statements": ["error", 30],
  },
});

eslintConfig.push({
  files: [
    "src/lib/**/*.{ts,tsx}",
    "src/app/actions/**/*.{ts,tsx}",
    "src/app/api/**/*.{ts,tsx}",
    "src/worker/**/*.{ts,tsx}",
  ],
  rules: {
    "max-lines-per-function": [
      "error",
      { max: 150, skipBlankLines: true, skipComments: true },
    ],
  },
});

export default eslintConfig;

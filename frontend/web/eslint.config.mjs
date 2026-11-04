import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    // Bug-catching rules (rules-of-hooks, prefer-const, …) stay errors.
    // These are existing style backlog: reported as warnings so CI stays useful.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "react/no-unescaped-entities": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      // A leading underscore marks a parameter/variable that is intentionally unused
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_", varsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_", caughtErrors: "none", ignoreRestSiblings: true,
      }],
      // Only matters with the React Compiler, which this app does not use
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
  {
    ignores: [
      ".next/**", "node_modules/**", "out/**", "public/**", "e2e/**",
      "playwright-report/**", "test-results/**", "next-env.d.ts", "*.config.js",
    ],
  },
];

export default config;

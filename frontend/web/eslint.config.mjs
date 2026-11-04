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
      // These rules describe what the React Compiler needs; this app doesn't use the
      // compiler. Its pages load data in effects on purpose (fetch on mount, read
      // localStorage after hydration), which these rules flag wholesale. The classic
      // hook rules (rules-of-hooks, exhaustive-deps) stay on.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/preserve-manual-memoization": "off",
      // A leading underscore marks a parameter/variable that is intentionally unused
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_", varsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_", caughtErrors: "none", ignoreRestSiblings: true,
      }],
    },
  },
  {
    // Test fixtures build partial objects on purpose
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  {
    ignores: [
      ".next/**", "node_modules/**", "out/**", "public/**", "e2e/**",
      "playwright-report/**", "test-results/**", "next-env.d.ts", "*.config.js",
    ],
  },
];

export default config;

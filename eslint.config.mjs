import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: ["scripts/dev/*.cjs", ".next/**", ".open-next/**", "node_modules/**", "delivery/overlay/**", ".claude/**"],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "@typescript-eslint/no-unused-expressions": "off",
      "prefer-const": "off",
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-img-element": "warn",
      // قواعد المترجم الجديدة في react-hooks 7: لم تكن ضمن معيار المشروع ولا تغيّر السلوك
      "react-hooks/purity": "off",
      "react-hooks/static-components": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
];
export default config;
